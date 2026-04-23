/**
 * app/scanner.tsx
 * Drug label scanner — camera → GPT-4o vision → review → save to medicines table.
 *
 * Workflow:
 *   1. Camera with frame guide
 *   2. Capture photo (base64)
 *   3. Send to OpenAI GPT-4o vision → structured MedScanResult
 *   4. Review + edit form (pre-filled by AI)
 *   5. Save to `medicines` table; check for duplicates by English name
 *   6. Success screen → optionally assign to a patient (creates patient_prescription)
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
import { analyzeMedicationLabel, type MedScanResult } from '../src/lib/openai'
import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import type { MealTime, PatientsRow } from '../src/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types
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

interface ReviewForm {
  name_th: string
  name_en: string
  strength: string
  unit: string
  dosage_form: string
  frequency: string
  quantity: string
  hospital: string
  confidence: number
}

const EMPTY_FORM: ReviewForm = {
  name_th: '', name_en: '', strength: '', unit: '',
  dosage_form: '', frequency: '', quantity: '', hospital: '', confidence: 1,
}

type ScreenState = 'camera' | 'analyzing' | 'review' | 'success'

// ─────────────────────────────────────────────────────────────────────────────
// Assign to Patient modal
// ─────────────────────────────────────────────────────────────────────────────

interface AssignModalProps {
  visible: boolean
  medicineId: string
  medicineName: string
  wardId: string
  onClose: () => void
  onAssigned: (patientName: string) => void
}

function AssignToPatientModal({ visible, medicineId, medicineName, wardId, onClose, onAssigned }: AssignModalProps) {
  const [patients, setPatients] = useState<PatientsRow[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientsRow | null>(null)
  const [doseQty, setDoseQty] = useState('1')
  const [selectedMealTimes, setSelectedMealTimes] = useState<MealTime[]>([])
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'pick' | 'config'>('pick')

  useEffect(() => {
    if (!visible) return
    setStep('pick')
    setSelectedPatient(null)
    setSelectedMealTimes([])
    setDoseQty('1')

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
  }, [visible, wardId])

  const toggleMealTime = (mt: MealTime) => {
    setSelectedMealTimes((prev) =>
      prev.includes(mt) ? prev.filter((t) => t !== mt) : [...prev, mt],
    )
  }

  const handleAssign = async () => {
    if (!selectedPatient) return
    if (selectedMealTimes.length === 0) {
      Alert.alert('Select meal time', 'Please select at least one meal time.')
      return
    }

    const qty = parseInt(doseQty, 10)
    if (!qty || qty < 1) {
      Alert.alert('Invalid dose', 'Please enter a valid dose quantity.')
      return
    }

    setSaving(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await supabase.from('patient_prescriptions').insert({
        patient_id:   selectedPatient.id,
        medicine_id:  medicineId,
        dose_quantity: qty,
        meal_times:   selectedMealTimes,
        start_date:   today,
        is_active:    true,
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF9F2] rounded-t-[32px] px-5 pt-5 pb-8" style={{ maxHeight: '80%' }}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 mr-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-[#8E4B14]">
                {step === 'pick' ? 'Assign to Patient' : 'Set Prescription'}
              </Text>
              <Text className="text-lg font-bold text-[#2E241B] mt-1" numberOfLines={1}>
                {step === 'pick' ? medicineName : `For ${selectedPatient?.name ?? ''}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-[#F0E8DE] items-center justify-center">
              <Ionicons name="close" size={18} color="#5E5145" />
            </TouchableOpacity>
          </View>

          {/* Step 1: pick patient */}
          {step === 'pick' && (
            <>
              {loadingPatients ? (
                <View className="py-10 items-center">
                  <ActivityIndicator color="#C96B1A" />
                  <Text className="text-sm text-[#7D6E60] mt-3">Loading patients...</Text>
                </View>
              ) : patients.length === 0 ? (
                <View className="py-10 items-center">
                  <Text className="text-4xl mb-3">🏥</Text>
                  <Text className="text-sm text-[#7D6E60] text-center">No active patients found in this ward.</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
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
              )}
            </>
          )}

          {/* Step 2: configure prescription */}
          {step === 'config' && selectedPatient && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Back to patient list */}
              <TouchableOpacity
                onPress={() => setStep('pick')}
                className="flex-row items-center mb-4"
              >
                <Ionicons name="arrow-back" size={16} color="#8E4B14" />
                <Text className="text-sm text-[#8E4B14] ml-1">Change patient</Text>
              </TouchableOpacity>

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

              {/* Meal times */}
              <Text className="text-xs font-semibold text-[#7D6E60] uppercase tracking-wide mb-2">
                Meal Times
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {MEAL_TIMES.map((mt) => {
                  const active = selectedMealTimes.includes(mt.value)
                  return (
                    <TouchableOpacity
                      key={mt.value}
                      onPress={() => toggleMealTime(mt.value)}
                      className={`flex-row items-center px-4 py-2.5 rounded-2xl border ${
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

              <Button
                title={saving ? 'Assigning...' : 'Assign Prescription'}
                onPress={handleAssign}
                variant="primary"
                loading={saving}
                disabled={saving || selectedMealTimes.length === 0}
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
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric'
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
  label: string
  value: string
  onSelect: (v: DosageForm) => void
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

  // ── Step 1: capture → analyze ─────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return
    setAnalyzeError(null)
    setScreenState('analyzing')

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true })
      if (!photo?.base64) throw new Error('No image data captured')

      const result: MedScanResult = await analyzeMedicationLabel(photo.base64)

      setForm({
        name_th:     result.name_th     ?? '',
        name_en:     result.name_en     ?? '',
        strength:    result.strength    ?? '',
        unit:        result.unit        ?? '',
        dosage_form: result.dosage_form ?? '',
        frequency:   result.frequency   ?? '',
        quantity:    result.quantity    ?? '',
        hospital:    result.hospital    ?? '',
        confidence:  typeof result.confidence === 'number' ? result.confidence : 1,
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

  // ── Step 2: save to medicines table ───────────────────────────────────────
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

      const strength = form.unit
        ? `${form.strength} ${form.unit}`.trim()
        : form.strength

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
          name:         combinedName,
          dosage_form:  form.dosage_form || null,
          strength:     strength || null,
          description:  [
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
      const msg = err instanceof Error ? err.message : 'Save failed'
      Alert.alert('Save failed', msg)
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Permission states
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
  // Camera view
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View className="flex-row items-center px-4 pt-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
            >
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
                  {[
                    { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
                    { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
                    { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
                    { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
                  ].map((style, i) => (
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
            { icon: '📋', text: 'Extracting medication details', done: false },
          ].map((step, i) => (
            <View key={i} className="flex-row items-center mb-3">
              <Text className="text-lg mr-3">{step.icon}</Text>
              <Text className="text-sm text-gray-600">{step.text}</Text>
              {step.done
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
  // Success screen
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'success') {
    const displayName = [form.name_th, form.name_en].filter(Boolean).join(' / ') || 'Medicine'

    return (
      <SafeAreaView className="flex-1 bg-[#FFF9F1] px-6">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}>
          {/* Status icon */}
          <View className={`w-20 h-20 rounded-[24px] items-center justify-center mb-6 self-center ${isDuplicate ? 'bg-blue-50' : 'bg-green-50'}`}>
            <Text className="text-4xl">{isDuplicate ? 'ℹ️' : '✅'}</Text>
          </View>

          <Text className="text-xl font-bold text-gray-900 text-center mb-1">
            {isDuplicate ? 'Already in Database' : 'Saved Successfully'}
          </Text>
          <Text className="text-sm font-semibold text-gray-700 text-center mb-1">{displayName}</Text>
          {form.strength ? (
            <Text className="text-xs text-gray-400 text-center mb-5">
              {form.strength} {form.unit} · {form.dosage_form}
            </Text>
          ) : <View className="mb-5" />}

          {isDuplicate && (
            <View className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
              <Text className="text-sm text-blue-700 text-center">
                This medication is already in the system. No duplicate was created.
              </Text>
            </View>
          )}

          {/* Assigned confirmation */}
          {assignedTo && (
            <View className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5 flex-row items-center">
              <Text className="text-lg mr-2">✅</Text>
              <Text className="text-sm text-green-700 flex-1">
                Prescription assigned to <Text className="font-bold">{assignedTo}</Text>
              </Text>
            </View>
          )}

          {/* Assign to patient — only if we have a medicine ID */}
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
                <Text className="text-xs text-[#7D6E60] mt-0.5">Create a prescription for a patient in this ward</Text>
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
          <Button
            title="Back to Home"
            onPress={() => router.back()}
            variant="secondary"
          />
        </ScrollView>

        {savedMedId && (
          <AssignToPatientModal
            visible={showAssign}
            medicineId={savedMedId}
            medicineName={displayName}
            wardId={user?.ward_id ?? ''}
            onClose={() => setShowAssign(false)}
            onAssigned={(name) => {
              setShowAssign(false)
              setAssignedTo(name)
            }}
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
                High confidence ({Math.round(form.confidence * 100)}%) — looks good!
              </Text>
            </View>
          )}

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

          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Instructions</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <FormField label="Frequency" value={form.frequency} onChangeText={(v) => updateField('frequency', v)} placeholder="e.g. 3 times daily after meals" />
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
