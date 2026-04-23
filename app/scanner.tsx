/**
 * app/scanner.tsx
 * Drug label scanner — camera → GPT-4o vision → review → save to medicines table.
 *
 * Workflow:
 *   1. Camera with frame guide
 *   2. Capture photo (base64)
 *   3. Send to OpenAI GPT-4o vision → MedScanResult (includes parsed schedule_type)
 *   4. Review + edit form (pre-filled by AI)
 *   5. Save to `medicines` table; check for duplicates by name
 *   6. Success → "Assign to Patient" opens smart schedule modal:
 *      - Auto-selects schedule type from scanned frequency text
 *      - Supports: With Meals / Every X Hours / X Times Daily / As Needed
 *      - Saves to patient_prescriptions with meal_times[] + schedule metadata in notes
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../src/components/ui/Button'
import { analyzeMedicationLabel, type MedScanResult, type ScheduleType } from '../src/lib/openai'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import type { MealTime, PatientsRow } from '../src/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type DosageForm =
  | 'tablet' | 'capsule' | 'liquid' | 'injection'
  | 'patch' | 'inhaler' | 'drops' | 'cream' | 'suppository' | 'powder'

const FORM_OPTIONS: { value: DosageForm; label: string; emoji: string }[] = [
  { value: 'tablet',      label: 'Tablet',      emoji: '💊' },
  { value: 'capsule',     label: 'Capsule',     emoji: '💊' },
  { value: 'liquid',      label: 'Liquid',      emoji: '🧴' },
  { value: 'injection',   label: 'Injection',   emoji: '💉' },
  { value: 'patch',       label: 'Patch',       emoji: '🩹' },
  { value: 'inhaler',     label: 'Inhaler',     emoji: '🌬️' },
  { value: 'drops',       label: 'Drops',       emoji: '💧' },
  { value: 'cream',       label: 'Cream',       emoji: '🧴' },
  { value: 'suppository', label: 'Suppository', emoji: '⬛' },
  { value: 'powder',      label: 'Powder',      emoji: '🫙' },
]

const MEAL_TIMES: { value: MealTime; label: string; emoji: string }[] = [
  { value: 'morning', label: 'Morning',  emoji: '🌅' },
  { value: 'noon',    label: 'Noon',     emoji: '☀️' },
  { value: 'evening', label: 'Evening',  emoji: '🌆' },
  { value: 'bedtime', label: 'Bedtime',  emoji: '🌙' },
]

const HOUR_OPTIONS = [2, 4, 6, 8, 12, 24]
const TIMES_PER_DAY_OPTIONS = [1, 2, 3, 4, 6]

const MEAL_RELATION_OPTIONS: { value: 'before' | 'after' | 'with' | 'any'; label: string; emoji: string }[] = [
  { value: 'before', label: 'Before meals', emoji: '⏰' },
  { value: 'after',  label: 'After meals',  emoji: '🍽️' },
  { value: 'with',   label: 'With meals',   emoji: '🫙' },
  { value: 'any',    label: 'Anytime',      emoji: '🕐' },
]

interface ReviewForm {
  name_th: string
  name_en: string
  strength: string
  unit: string
  dosage_form: string
  frequency: string
  schedule_type: ScheduleType | ''
  frequency_hours: number
  times_per_day: number
  meal_relation: 'before' | 'after' | 'with' | 'any' | ''
  quantity: string
  hospital: string
  confidence: number
}

const EMPTY_FORM: ReviewForm = {
  name_th: '', name_en: '', strength: '', unit: '', dosage_form: '',
  frequency: '', schedule_type: '', frequency_hours: 4, times_per_day: 2,
  meal_relation: '', quantity: '', hospital: '', confidence: 1,
}

type ScreenState = 'camera' | 'analyzing' | 'review' | 'success'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: map any schedule type → meal_times[] for DB storage
// ─────────────────────────────────────────────────────────────────────────────

function scheduleToMealTimes(
  type: ScheduleType | '',
  hours: number,
  timesPerDay: number,
  selectedMealTimes: MealTime[],
): MealTime[] {
  switch (type) {
    case 'meal_time':
      return selectedMealTimes
    case 'interval_hours':
      if (hours <= 4)  return ['morning', 'noon', 'evening', 'bedtime']
      if (hours <= 6)  return ['morning', 'noon', 'evening']
      if (hours <= 8)  return ['morning', 'noon', 'bedtime']
      if (hours <= 12) return ['morning', 'bedtime']
      return ['morning']
    case 'times_per_day':
      if (timesPerDay >= 4) return ['morning', 'noon', 'evening', 'bedtime']
      if (timesPerDay === 3) return ['morning', 'noon', 'evening']
      if (timesPerDay === 2) return ['morning', 'bedtime']
      return ['morning']
    case 'as_needed':
      return []
    default:
      return selectedMealTimes
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart schedule modal
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduleConfig {
  type: ScheduleType | ''
  frequencyHours: number
  timesPerDay: number
  mealTimes: MealTime[]
  mealRelation: 'before' | 'after' | 'with' | 'any'
}

interface AssignModalProps {
  visible: boolean
  medicineId: string
  medicineName: string
  wardId: string
  initialSchedule: {
    type: ScheduleType | ''
    frequencyHours: number
    timesPerDay: number
    mealRelation: 'before' | 'after' | 'with' | 'any' | ''
    frequency: string  // raw text for display
  }
  onClose: () => void
  onAssigned: (patientName: string) => void
}

function ScheduleTypePicker({
  config,
  onChange,
}: {
  config: ScheduleConfig
  onChange: (c: ScheduleConfig) => void
}) {
  const TYPES: { value: ScheduleType; label: string; emoji: string; desc: string }[] = [
    { value: 'meal_time',      label: 'With Meals',      emoji: '🍽️', desc: 'Before / after / with specific meals' },
    { value: 'interval_hours', label: 'Every X Hours',   emoji: '⏰', desc: 'Fixed interval around the clock' },
    { value: 'times_per_day',  label: 'Times per Day',   emoji: '📅', desc: 'X times daily, evenly spaced' },
    { value: 'as_needed',      label: 'As Needed (PRN)', emoji: '💊', desc: 'Only when the patient needs it' },
  ]

  return (
    <View>
      {/* Type selector */}
      <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
        Schedule Type
      </Text>
      <View className="gap-2 mb-5">
        {TYPES.map((t) => {
          const active = config.type === t.value
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onChange({ ...config, type: t.value })}
              className={`flex-row items-center px-3 py-3 rounded-2xl border ${
                active ? 'bg-[#FFF0DD] border-[#C96B1A]' : 'bg-white border-[#E8D5C4]'
              }`}
            >
              <Text className="text-xl mr-3">{t.emoji}</Text>
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${active ? 'text-[#8E4B14]' : 'text-[#2E241B]'}`}>
                  {t.label}
                </Text>
                <Text className="text-xs text-[#7D6E60] mt-0.5">{t.desc}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={18} color="#C96B1A" />}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Sub-options per type */}
      {config.type === 'interval_hours' && (
        <View className="mb-4">
          <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
            Interval
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {HOUR_OPTIONS.map((h) => {
              const active = config.frequencyHours === h
              return (
                <TouchableOpacity
                  key={h}
                  onPress={() => onChange({ ...config, frequencyHours: h })}
                  className={`px-4 py-2.5 rounded-2xl border ${
                    active ? 'bg-[#FFF0DD] border-[#C96B1A]' : 'bg-white border-[#E8D5C4]'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-[#8E4B14]' : 'text-[#6F6254]'}`}>
                    {h === 24 ? 'Once/day' : `Every ${h}h`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <View className="bg-[#F6EBDD] rounded-xl px-3 py-2 mt-3">
            <Text className="text-xs text-[#8E4B14]">
              {config.frequencyHours <= 4
                ? '⚠️ Requires night-time administration. Confirm with nurse.'
                : config.frequencyHours <= 8
                ? `📋 Approximately ${Math.round(24 / config.frequencyHours)} doses per day`
                : `📋 ${Math.round(24 / config.frequencyHours)} doses per day`}
            </Text>
          </View>
        </View>
      )}

      {config.type === 'times_per_day' && (
        <View className="mb-4">
          <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
            How many times per day?
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {TIMES_PER_DAY_OPTIONS.map((n) => {
              const active = config.timesPerDay === n
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => onChange({ ...config, timesPerDay: n })}
                  className={`px-4 py-2.5 rounded-2xl border ${
                    active ? 'bg-[#FFF0DD] border-[#C96B1A]' : 'bg-white border-[#E8D5C4]'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? 'text-[#8E4B14]' : 'text-[#6F6254]'}`}>
                    {n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n}×`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {config.type === 'meal_time' && (
        <View className="mb-4">
          <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
            Meal Relation
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {MEAL_RELATION_OPTIONS.map((r) => {
              const active = config.mealRelation === r.value
              return (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => onChange({ ...config, mealRelation: r.value })}
                  className={`flex-row items-center px-3 py-2.5 rounded-2xl border ${
                    active ? 'bg-[#FFF0DD] border-[#C96B1A]' : 'bg-white border-[#E8D5C4]'
                  }`}
                >
                  <Text className="mr-1.5">{r.emoji}</Text>
                  <Text className={`text-sm font-semibold ${active ? 'text-[#8E4B14]' : 'text-[#6F6254]'}`}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
            Which Meals?
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TIMES.map((mt) => {
              const active = config.mealTimes.includes(mt.value)
              return (
                <TouchableOpacity
                  key={mt.value}
                  onPress={() => {
                    const next = active
                      ? config.mealTimes.filter((t) => t !== mt.value)
                      : [...config.mealTimes, mt.value]
                    onChange({ ...config, mealTimes: next })
                  }}
                  className={`flex-row items-center px-3 py-2.5 rounded-2xl border ${
                    active ? 'bg-[#FFF0DD] border-[#C96B1A]' : 'bg-white border-[#E8D5C4]'
                  }`}
                >
                  <Text className="mr-1.5">{mt.emoji}</Text>
                  <Text className={`text-sm font-semibold ${active ? 'text-[#8E4B14]' : 'text-[#6F6254]'}`}>
                    {mt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {config.type === 'as_needed' && (
        <View className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-3 mb-4">
          <Text className="text-sm text-amber-700">
            💊 PRN medication — caregivers administer when the patient requests or when clinically indicated. No fixed schedule is set.
          </Text>
        </View>
      )}
    </View>
  )
}

function AssignToPatientModal({
  visible, medicineId, medicineName, wardId, initialSchedule, onClose, onAssigned,
}: AssignModalProps) {
  const [patients, setPatients]           = useState<PatientsRow[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientsRow | null>(null)
  const [doseQty, setDoseQty]             = useState('1')
  const [saving, setSaving]               = useState(false)
  const [step, setStep]                   = useState<'pick' | 'config'>('pick')

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    type: 'meal_time',
    frequencyHours: 8,
    timesPerDay: 3,
    mealTimes: ['morning', 'noon', 'evening'],
    mealRelation: 'after',
  })

  // Auto-apply parsed schedule from scan when modal opens
  useEffect(() => {
    if (!visible) return
    setStep('pick')
    setSelectedPatient(null)
    setDoseQty('1')

    const t = initialSchedule.type || 'meal_time'
    setScheduleConfig({
      type: t as ScheduleType,
      frequencyHours: initialSchedule.frequencyHours || 8,
      timesPerDay: initialSchedule.timesPerDay || 3,
      mealRelation: (initialSchedule.mealRelation as ScheduleConfig['mealRelation']) || 'after',
      mealTimes: (() => {
        const mt = initialSchedule.timesPerDay
        if (t === 'times_per_day' || t === 'meal_time') {
          if (mt >= 4) return ['morning', 'noon', 'evening', 'bedtime'] as MealTime[]
          if (mt === 3) return ['morning', 'noon', 'evening'] as MealTime[]
          if (mt === 2) return ['morning', 'bedtime'] as MealTime[]
        }
        return ['morning', 'noon', 'evening'] as MealTime[]
      })(),
    })

    const load = async () => {
      setLoadingPatients(true)
      const query = supabase
        .from('patients')
        .select('id, name, photo_url, room_number, ward_id, status, date_of_birth, notes, created_at, updated_at')
        .eq('status', 'active')
        .order('name', { ascending: true })

      const { data } = wardId ? await query.eq('ward_id', wardId) : await query
      setPatients(data ?? [])
      setLoadingPatients(false)
    }
    load()
  }, [visible, wardId, initialSchedule])

  const handleAssign = async () => {
    if (!selectedPatient) return

    const qty = parseInt(doseQty, 10)
    if (!qty || qty < 1) {
      Alert.alert('Invalid dose', 'Please enter a valid dose quantity.')
      return
    }

    if (scheduleConfig.type === 'meal_time' && scheduleConfig.mealTimes.length === 0) {
      Alert.alert('Select meal times', 'Please select at least one meal time.')
      return
    }

    setSaving(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const mealTimes = scheduleToMealTimes(
        scheduleConfig.type,
        scheduleConfig.frequencyHours,
        scheduleConfig.timesPerDay,
        scheduleConfig.mealTimes,
      )

      // Store full schedule detail in notes as JSON for display/audit
      const scheduleNote = JSON.stringify({
        schedule_type:   scheduleConfig.type,
        frequency_hours: scheduleConfig.type === 'interval_hours' ? scheduleConfig.frequencyHours : undefined,
        times_per_day:   scheduleConfig.type === 'times_per_day'  ? scheduleConfig.timesPerDay    : undefined,
        meal_relation:   scheduleConfig.type === 'meal_time'      ? scheduleConfig.mealRelation   : undefined,
        raw_frequency:   initialSchedule.frequency,
      })

      const { error } = await supabase.from('patient_prescriptions').insert({
        patient_id:    selectedPatient.id,
        medicine_id:   medicineId,
        dose_quantity: qty,
        meal_times:    mealTimes,
        start_date:    today,
        is_active:     true,
        notes:         scheduleNote,
      })
      if (error) throw error
      onAssigned(selectedPatient.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign prescription'
      Alert.alert('Error', msg)
    } finally {
      setSaving(false)
    }
  }

  const scheduleLabel = (() => {
    switch (scheduleConfig.type) {
      case 'interval_hours':
        return scheduleConfig.frequencyHours === 24
          ? 'Once per day'
          : `Every ${scheduleConfig.frequencyHours} hours`
      case 'times_per_day':
        return scheduleConfig.timesPerDay === 1
          ? 'Once per day'
          : scheduleConfig.timesPerDay === 2
          ? 'Twice per day'
          : `${scheduleConfig.timesPerDay}× per day`
      case 'as_needed':
        return 'As needed (PRN)'
      default:
        return scheduleConfig.mealTimes.map((t) => MEAL_TIMES.find((m) => m.value === t)?.label).join(', ')
    }
  })()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF9F2] rounded-t-[32px] px-5 pt-5 pb-8" style={{ maxHeight: '90%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-[#8E4B14]">
                {step === 'pick' ? 'Select Patient' : 'Prescription Setup'}
              </Text>
              <Text className="text-lg font-bold text-[#2E241B] mt-0.5" numberOfLines={1}>
                {step === 'pick' ? medicineName : selectedPatient?.name ?? ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-[#F0E8DE] items-center justify-center">
              <Ionicons name="close" size={18} color="#5E5145" />
            </TouchableOpacity>
          </View>

          {/* Step 1: pick patient */}
          {step === 'pick' && (
            loadingPatients ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#C96B1A" />
                <Text className="text-sm text-[#7D6E60] mt-3">Loading patients...</Text>
              </View>
            ) : patients.length === 0 ? (
              <View className="py-10 items-center">
                <Text className="text-4xl mb-3">🏥</Text>
                <Text className="text-sm text-[#7D6E60] text-center">No active patients in this ward.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {patients.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => { setSelectedPatient(p); setStep('config') }}
                    className="flex-row items-center py-3.5 border-b border-[#F0E8DE]"
                  >
                    <View className="w-10 h-10 rounded-full bg-[#F6EBDD] items-center justify-center mr-3">
                      <Text className="text-base">👤</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-[#2E241B]">{p.name}</Text>
                      {p.room_number ? (
                        <Text className="text-xs text-[#7D6E60] mt-0.5">Room {p.room_number}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C4B5A8" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          )}

          {/* Step 2: configure */}
          {step === 'config' && selectedPatient && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Change patient */}
              <TouchableOpacity onPress={() => setStep('pick')} className="flex-row items-center mb-4">
                <Ionicons name="arrow-back" size={16} color="#8E4B14" />
                <Text className="text-sm text-[#8E4B14] ml-1">Change patient</Text>
              </TouchableOpacity>

              {/* Auto-detected banner */}
              {initialSchedule.frequency ? (
                <View className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-3 py-2.5 mb-4 flex-row items-start">
                  <Text className="text-base mr-2">🤖</Text>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-[#0369A1]">Auto-detected from label</Text>
                    <Text className="text-xs text-[#0C4A6E] mt-0.5">
                      "{initialSchedule.frequency}" → {scheduleLabel}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Dose quantity */}
              <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
                Dose Quantity
              </Text>
              <View className="flex-row items-center bg-[#F6EBDD] rounded-2xl px-4 py-3 mb-5">
                <TouchableOpacity
                  onPress={() => setDoseQty((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                  className="w-9 h-9 rounded-full bg-white items-center justify-center"
                >
                  <Ionicons name="remove" size={18} color="#8E4B14" />
                </TouchableOpacity>
                <TextInput
                  value={doseQty}
                  onChangeText={setDoseQty}
                  keyboardType="numeric"
                  className="flex-1 text-center text-lg font-bold text-[#2E241B]"
                />
                <TouchableOpacity
                  onPress={() => setDoseQty((v) => String(parseInt(v, 10) + 1))}
                  className="w-9 h-9 rounded-full bg-white items-center justify-center"
                >
                  <Ionicons name="add" size={18} color="#8E4B14" />
                </TouchableOpacity>
              </View>

              {/* Schedule type + sub-options */}
              <ScheduleTypePicker config={scheduleConfig} onChange={setScheduleConfig} />

              {/* Summary chip */}
              <View className="bg-[#F6EBDD] rounded-xl px-3 py-2.5 mb-4 flex-row items-center">
                <Ionicons name="calendar-outline" size={16} color="#8E4B14" />
                <Text className="text-xs text-[#8E4B14] ml-2 font-semibold">
                  {scheduleLabel}
                </Text>
              </View>

              <Button
                title={saving ? 'Assigning...' : 'Assign Prescription'}
                onPress={handleAssign}
                variant="primary"
                loading={saving}
                disabled={saving}
              />
              <View className="h-2" />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Review form sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (v: string) => void
  placeholder?: string; keyboardType?: 'default' | 'numeric'
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        className="bg-white border border-gray-200 rounded-xl px-3 min-h-[48px] text-sm text-gray-800"
      />
    </View>
  )
}

function FormDropdown({
  label, value, onSelect,
}: {
  label: string; value: string; onSelect: (v: DosageForm) => void
}) {
  const [open, setOpen] = useState(false)
  const current = FORM_OPTIONS.find((o) => o.value === value)

  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="bg-white border border-gray-200 rounded-xl px-3 min-h-[48px] flex-row items-center justify-between"
      >
        <Text className={`text-sm ${current ? 'text-gray-800' : 'text-gray-400'}`}>
          {current ? `${current.emoji}  ${current.label}` : 'Select medication form'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {open && (
        <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden">
          {FORM_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); setOpen(false) }}
              className="px-3 min-h-[44px] justify-center border-b border-gray-50 flex-row items-center"
            >
              <Text className="mr-2">{opt.emoji}</Text>
              <Text className={`text-sm ${value === opt.value ? 'text-orange-500 font-semibold' : 'text-gray-700'}`}>
                {opt.label}
              </Text>
              {value === opt.value && (
                <Ionicons name="checkmark" size={14} color="#E8721A" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  const [screenState, setScreenState]   = useState<ScreenState>('camera')
  const [form, setForm]                 = useState<ReviewForm>(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [savedMedId, setSavedMedId]     = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate]   = useState(false)
  const [showAssign, setShowAssign]     = useState(false)
  const [assignedTo, setAssignedTo]     = useState<string | null>(null)

  const updateField = (field: keyof ReviewForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleCapture = async () => {
    if (!cameraRef.current) return
    setAnalyzeError(null)
    setScreenState('analyzing')

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true })
      if (!photo?.base64) throw new Error('No image data captured')

      const result: MedScanResult = await analyzeMedicationLabel(photo.base64)

      setForm({
        name_th:         result.name_th         ?? '',
        name_en:         result.name_en         ?? '',
        strength:        result.strength        ?? '',
        unit:            result.unit            ?? '',
        dosage_form:     result.dosage_form     ?? '',
        frequency:       result.frequency       ?? '',
        schedule_type:   result.schedule_type   ?? '',
        frequency_hours: result.frequency_hours ?? 8,
        times_per_day:   result.times_per_day   ?? 3,
        meal_relation:   result.meal_relation   ?? '',
        quantity:        result.quantity        ?? '',
        hospital:        result.hospital        ?? '',
        confidence:      typeof result.confidence === 'number' ? result.confidence : 1,
      })
      setScreenState('review')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setAnalyzeError(msg)
      setScreenState('camera')
      Alert.alert('Analysis failed', `${msg}\n\nMake sure the label is well-lit and inside the frame.`)
    }
  }

  const handleRetake = () => {
    setForm(EMPTY_FORM)
    setAnalyzeError(null)
    setScreenState('camera')
  }

  const handleSave = async () => {
    const nameEn = form.name_en.trim()
    const nameTh = form.name_th.trim()
    if (!nameEn && !nameTh) {
      Alert.alert('Missing name', 'Please enter at least the medication name before saving.')
      return
    }

    setSaving(true)
    try {
      const combinedName = nameTh && nameEn
        ? `${nameTh} / ${nameEn}`
        : nameTh || nameEn

      const strength = form.unit ? `${form.strength} ${form.unit}`.trim() : form.strength

      const { data: existing } = await supabase
        .from('medicines')
        .select('id, name')
        .ilike('name', `%${nameEn || nameTh}%`)
        .limit(1)
        .maybeSingle()

      if (existing) {
        setIsDuplicate(true)
        setSavedMedId(existing.id)
        setScreenState('success')
        setSaving(false)
        return
      }

      const { data: inserted, error } = await supabase
        .from('medicines')
        .insert({
          name:        combinedName,
          dosage_form: form.dosage_form || null,
          strength:    strength || null,
          description: [
            form.frequency ? `Frequency: ${form.frequency}` : null,
            form.quantity  ? `Quantity: ${form.quantity}`   : null,
            form.hospital  ? `Issued by: ${form.hospital}`  : null,
          ].filter(Boolean).join(' | ') || null,
        })
        .select('id')
        .single()

      if (error) throw error

      setIsDuplicate(false)
      setSavedMedId(inserted?.id ?? null)
      setAssignedTo(null)
      setScreenState('success')
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Permission screens
  // ─────────────────────────────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#E8721A" />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-5xl mb-5">📷</Text>
        <Text className="text-lg font-bold text-gray-900 text-center mb-2">Camera Access Required</Text>
        <Text className="text-sm text-gray-500 text-center mb-8">
          PILLo needs camera access to scan medication labels.
        </Text>
        <Button title="Allow Camera Access" onPress={requestPermission} variant="primary" />
        <TouchableOpacity onPress={() => router.back()} className="mt-4 min-h-[48px] items-center justify-center">
          <Text className="text-sm text-gray-400">Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View className="flex-row items-center px-4 pt-4">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-black/40 items-center justify-center">
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white font-semibold text-base ml-3">Scan Medication Label</Text>
          </View>

          <View className="flex-1 items-center justify-center">
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: '100%', height: 40, backgroundColor: 'rgba(0,0,0,0.45)' }} />
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 40, height: 190, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                <View style={{ width: 300, height: 190, borderWidth: 2.5, borderColor: '#E8721A', borderRadius: 14 }}>
                  {([
                    { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
                    { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
                    { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
                    { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
                  ] as const).map((style, i) => (
                    <View key={i} style={{ position: 'absolute', width: 22, height: 22, borderColor: '#E8721A', ...style }} />
                  ))}
                </View>
                <View style={{ width: 40, height: 190, backgroundColor: 'rgba(0,0,0,0.45)' }} />
              </View>
              <View style={{ width: '100%', height: 40, backgroundColor: 'rgba(0,0,0,0.45)' }} />
            </View>
            <Text className="text-white/80 text-xs mt-4 text-center px-8">
              Align the medication label inside the orange frame
            </Text>
            {analyzeError && (
              <View className="bg-red-500/80 rounded-xl px-4 py-2 mt-3 mx-8">
                <Text className="text-white text-xs text-center">Previous scan failed — please try again</Text>
              </View>
            )}
          </View>

          <View className="items-center pb-12">
            <TouchableOpacity
              onPress={handleCapture}
              style={{
                width: 76, height: 76, borderRadius: 38,
                backgroundColor: '#E8721A', alignItems: 'center', justifyContent: 'center',
                borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)',
              }}
            >
              <Ionicons name="camera" size={30} color="white" />
            </TouchableOpacity>
            <Text className="text-white/60 text-xs mt-3">Tap to capture</Text>
          </View>
        </CameraView>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analyzing
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'analyzing') {
    return (
      <SafeAreaView className="flex-1 bg-[#FFF9F1] items-center justify-center px-8">
        <View className="w-20 h-20 rounded-[24px] bg-[#FFF0E0] items-center justify-center mb-6">
          <ActivityIndicator size="large" color="#E8721A" />
        </View>
        <Text className="text-xl font-bold text-gray-900 text-center mb-2">Reading Label...</Text>
        <Text className="text-sm text-gray-500 text-center leading-5">
          AI is analyzing the medication label.{'\n'}This usually takes 3–5 seconds.
        </Text>
        <View className="mt-10 w-full">
          {[
            { icon: '📸', text: 'Photo captured', done: true },
            { icon: '🤖', text: 'Sending to GPT-4o Vision', done: false },
            { icon: '📋', text: 'Extracting medication + schedule', done: false },
          ].map((s, i) => (
            <View key={i} className="flex-row items-center mb-3">
              <Text className="text-lg mr-3">{s.icon}</Text>
              <Text className="text-sm text-gray-600">{s.text}</Text>
              {s.done
                ? <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={{ marginLeft: 'auto' }} />
                : i === 1
                ? <ActivityIndicator size="small" color="#E8721A" style={{ marginLeft: 'auto' }} />
                : null}
            </View>
          ))}
        </View>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Success
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'success') {
    const displayName = [form.name_th, form.name_en].filter(Boolean).join(' / ') || 'Medicine'

    return (
      <SafeAreaView className="flex-1 bg-[#FFF9F1] px-6">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}>
          <View className={`w-20 h-20 rounded-[24px] items-center justify-center mb-6 self-center ${isDuplicate ? 'bg-blue-50' : 'bg-green-50'}`}>
            <Text className="text-4xl">{isDuplicate ? 'ℹ️' : '✅'}</Text>
          </View>

          <Text className="text-xl font-bold text-gray-900 text-center mb-1">
            {isDuplicate ? 'Already in Database' : 'Saved Successfully'}
          </Text>
          <Text className="text-sm font-semibold text-gray-700 text-center mb-1">{displayName}</Text>
          {form.strength ? (
            <Text className="text-xs text-gray-400 text-center mb-2">
              {form.strength} {form.unit} · {form.dosage_form}
            </Text>
          ) : null}
          {form.frequency ? (
            <Text className="text-xs text-[#8E4B14] text-center mb-5">⏱ {form.frequency}</Text>
          ) : <View className="mb-5" />}

          {isDuplicate && (
            <View className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <Text className="text-sm text-blue-700 text-center">
                This medication is already in the system. No duplicate was created.
              </Text>
            </View>
          )}

          {assignedTo && (
            <View className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <Text className="text-lg mr-2">✅</Text>
              <Text className="text-sm text-green-700 flex-1">
                Prescription assigned to <Text className="font-bold">{assignedTo}</Text>
              </Text>
            </View>
          )}

          {savedMedId && !assignedTo && (
            <TouchableOpacity
              onPress={() => setShowAssign(true)}
              className="bg-[#FFF0DD] border border-[#E8CFB0] rounded-2xl px-4 py-4 mb-4 flex-row items-center"
            >
              <View className="w-10 h-10 rounded-full bg-[#F6EBDD] items-center justify-center mr-3">
                <Ionicons name="person-add-outline" size={20} color="#8E4B14" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-[#2E241B]">Assign to Patient</Text>
                <Text className="text-xs text-[#7D6E60] mt-0.5">Create a prescription with auto-detected schedule</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C4B5A8" />
            </TouchableOpacity>
          )}

          <Button
            title="Scan Another Label"
            onPress={() => {
              setForm(EMPTY_FORM)
              setSavedMedId(null)
              setIsDuplicate(false)
              setAssignedTo(null)
              setScreenState('camera')
            }}
            variant="primary"
            className="mb-3"
          />
          <Button title="Back to Home" onPress={() => router.back()} variant="secondary" />
        </ScrollView>

        {savedMedId && (
          <AssignToPatientModal
            visible={showAssign}
            medicineId={savedMedId}
            medicineName={displayName}
            wardId={user?.ward_id ?? ''}
            initialSchedule={{
              type:          form.schedule_type,
              frequencyHours: form.frequency_hours,
              timesPerDay:   form.times_per_day,
              mealRelation:  form.meal_relation,
              frequency:     form.frequency,
            }}
            onClose={() => setShowAssign(false)}
            onAssigned={(name) => { setShowAssign(false); setAssignedTo(name) }}
          />
        )}
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#F8F7F5]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-row items-center px-4 pt-4 pb-3 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={handleRetake} className="w-10 h-10 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color="#4B5563" />
          </TouchableOpacity>
          <View className="flex-1 ml-2">
            <Text className="text-base font-bold text-gray-900">Review Information</Text>
            <Text className="text-xs text-gray-400">Edit any fields the AI may have missed</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {form.confidence < 0.85 ? (
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex-row items-start">
              <Text className="text-lg mr-2">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-amber-800">Low confidence ({Math.round(form.confidence * 100)}%)</Text>
                <Text className="text-xs text-amber-700 mt-0.5">Please review every field carefully before saving.</Text>
              </View>
            </View>
          ) : (
            <View className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4 flex-row items-center">
              <Text className="text-lg mr-2">✅</Text>
              <Text className="text-sm text-green-700 font-medium">
                High confidence ({Math.round(form.confidence * 100)}%)
              </Text>
            </View>
          )}

          {/* Show detected schedule type as a banner */}
          {form.frequency ? (
            <View className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl px-3 py-2.5 mb-4 flex-row items-center">
              <Text className="text-base mr-2">🤖</Text>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-[#0369A1]">Schedule detected</Text>
                <Text className="text-xs text-[#0C4A6E]">
                  {form.frequency}
                  {form.schedule_type ? ` (${form.schedule_type.replace(/_/g, ' ')})` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-1">Medication Name</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <FormField label="Thai Name (ชื่อภาษาไทย)" value={form.name_th} onChangeText={(v) => updateField('name_th', v)} placeholder="e.g. อะม็อกซีซิลลิน" />
            <FormField label="English / Generic Name" value={form.name_en} onChangeText={(v) => updateField('name_en', v)} placeholder="e.g. Amoxicillin" />
          </View>

          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dosage</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField label="Strength" value={form.strength} onChangeText={(v) => updateField('strength', v)} placeholder="500" keyboardType="numeric" />
              </View>
              <View className="flex-1">
                <FormField label="Unit" value={form.unit} onChangeText={(v) => updateField('unit', v)} placeholder="mg" />
              </View>
            </View>
            <FormDropdown label="Medication Form" value={form.dosage_form} onSelect={(v) => setForm((prev) => ({ ...prev, dosage_form: v }))} />
          </View>

          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Schedule & Instructions</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <FormField label="Frequency (as on label)" value={form.frequency} onChangeText={(v) => updateField('frequency', v)} placeholder="e.g. every 4 hours / twice daily" />
            <FormField label="Total Quantity" value={form.quantity} onChangeText={(v) => updateField('quantity', v)} placeholder="e.g. 30 tablets" keyboardType="numeric" />
          </View>

          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Source</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <FormField label="Hospital / Pharmacy" value={form.hospital} onChangeText={(v) => updateField('hospital', v)} placeholder="e.g. Saensuk Healthcare Center" />
          </View>

          <Button title={saving ? 'Saving...' : 'Save to Database'} onPress={handleSave} variant="primary" loading={saving} disabled={saving} />
          <TouchableOpacity onPress={handleRetake} className="items-center justify-center min-h-[48px] mt-2">
            <Text className="text-sm text-gray-400">Retake Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
