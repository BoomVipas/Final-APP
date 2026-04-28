/**
 * app/patient/[id].tsx
 * Figma-inspired patient detail screen with graceful live-data fallbacks.
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { usePatientStore } from '../../src/stores/patientStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleItem } from '../../src/stores/medicationStore'
import { USE_MOCK, MOCK_PRESCRIPTIONS, mockSelectPatient } from '../../src/mocks'
import { supabase } from '../../src/lib/supabase'
import { scheduleRefillReminder } from '../../src/lib/notifications'
import type { LogMethod, LogStatus, MealTime } from '../../src/types/database'
import { PatientAvatar } from '../../src/components/shared/PatientAvatar'
import HomeIcon from '../../icons/Home.svg'
import WardIcon from '../../icons/Ward.svg'
import ProfileIcon from '../../icons/Profile.svg'
import MedicineIcon from '../../icons/Medicine.svg'
import HealthIcon from '../../icons/Health.svg'
import AppointmentIcon from '../../icons/Appointment.svg'
import DetailsIcon from '../../icons/Details.svg'

type DetailTab = 'medications' | 'appointments' | 'device' | 'history'
type WarningTone = 'critical' | 'warning' | null

interface MedicationHistoryEntry {
  id: string
  administered_at: string
  meal_time: MealTime
  status: LogStatus
  method: LogMethod
  refusal_reason: string | null
  notes: string | null
  medicine_name: string
  medicine_strength: string | null
}

const MOCK_HISTORY: MedicationHistoryEntry[] = [
  {
    id: 'mock-h-1',
    administered_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    meal_time: 'noon',
    status: 'confirmed',
    method: 'normal',
    refusal_reason: null,
    notes: 'Taken with water after lunch',
    medicine_name: 'Amlodipine',
    medicine_strength: '5 mg',
  },
  {
    id: 'mock-h-2',
    administered_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    meal_time: 'morning',
    status: 'refused',
    method: 'normal',
    refusal_reason: 'Patient refused',
    notes: null,
    medicine_name: 'Metformin',
    medicine_strength: '500 mg',
  },
  {
    id: 'mock-h-3',
    administered_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    meal_time: 'bedtime',
    status: 'confirmed',
    method: 'crushed',
    refusal_reason: null,
    notes: null,
    medicine_name: 'Risperidone',
    medicine_strength: '2 mg',
  },
  {
    id: 'mock-h-4',
    administered_at: new Date(Date.now() - 1000 * 60 * 60 * 33).toISOString(),
    meal_time: 'evening',
    status: 'skipped',
    method: 'normal',
    refusal_reason: null,
    notes: 'NPO before procedure',
    medicine_name: 'Metoprolol',
    medicine_strength: '25 mg',
  },
]

interface DemoPatientDetail {
  id: string
  name: string
  room_number: string
  age: number
  heroMedicationCount: number
  statType: number
  statDosePerDay: number
  statEndDate: number
  photo_url?: string | null
}

interface LivePrescription {
  id: string
  patient_id: string
  medicine_id: string | null
  dose_quantity: number
  meal_times: MealTime[]
  notes: string | null
  start_date: string
  end_date: string | null
  medicines: {
    id: string
    name: string
    strength: string | null
    dosage_form: string | null
  } | null
}

interface DisplayMedication {
  id: string
  medicineId?: string | null
  medicineName: string
  doseQuantity: number
  dosageForm: string | null
  instructions: string | null
  mealTimes: MealTime[]
  daysLeft: number | null
  endDateLabel: string | null
  warningTone: WarningTone
  quantityRemaining?: number | null
  initialQuantity?: number | null
}

interface DetailPanelItem {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  meta: string
  badge: string
  badgeTone: 'neutral' | 'success' | 'warning'
}

interface CabinetSlotInfo {
  id: string
  cabinet_position: number
  partition: string
  quantity_remaining: number
  initial_quantity: number | null
  expiry_date: string | null
  medicine: { name: string; strength: string | null } | null
}

const DISPLAY_MEALS: MealTime[] = ['morning', 'noon', 'evening', 'bedtime']

const MEAL_LABELS: Record<MealTime, string> = {
  morning: 'Morning',
  noon: 'Noon',
  evening: 'Evening',
  bedtime: 'Night',
}

const DEMO_PATIENTS: Record<string, DemoPatientDetail> = {
  p1: {
    id: 'p1',
    name: 'Mrs. Somsri Phakrammongkol',
    room_number: 'A-101',
    age: 79,
    heroMedicationCount: 9,
    statType: 16,
    statDosePerDay: 12,
    statEndDate: 4,
  },
  p2: {
    id: 'p2',
    name: 'Mrs. Somchai Rungreang',
    room_number: 'A-102',
    age: 79,
    heroMedicationCount: 12,
    statType: 16,
    statDosePerDay: 12,
    statEndDate: 3,
  },
  p3: {
    id: 'p3',
    name: 'Mr. Mana Jai',
    room_number: 'B-203',
    age: 69,
    heroMedicationCount: 5,
    statType: 10,
    statDosePerDay: 8,
    statEndDate: 1,
  },
  p4: {
    id: 'p4',
    name: 'Mrs. Dararat Prasartngam',
    room_number: 'B-204',
    age: 80,
    heroMedicationCount: 11,
    statType: 15,
    statDosePerDay: 11,
    statEndDate: 5,
  },
  p5: {
    id: 'p5',
    name: 'Mrs. Kanya Singkow',
    room_number: 'B-205',
    age: 67,
    heroMedicationCount: 12,
    statType: 13,
    statDosePerDay: 10,
    statEndDate: 2,
  },
}

const DEMO_MEDICATIONS: Record<string, DisplayMedication[]> = {
  p1: [
    {
      id: 'p1-med-1',
      medicineName: 'Amlodipine 5 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'Before bedtime',
      mealTimes: ['morning'],
      daysLeft: 3,
      endDateLabel: 'Mar 14',
      warningTone: 'critical',
    },
    {
      id: 'p1-med-2',
      medicineName: 'Metoprolol 25 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'Before bedtime',
      mealTimes: ['morning', 'noon', 'evening', 'bedtime'],
      daysLeft: 25,
      endDateLabel: null,
      warningTone: null,
    },
    {
      id: 'p1-med-3',
      medicineName: 'Risperidone 2 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'After food',
      mealTimes: ['morning', 'bedtime'],
      daysLeft: 10,
      endDateLabel: 'Mar 14',
      warningTone: 'warning',
    },
  ],
  p2: [
    {
      id: 'p2-med-1',
      medicineName: 'Aspirin 81 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'After breakfast',
      mealTimes: ['morning'],
      daysLeft: 18,
      endDateLabel: null,
      warningTone: null,
    },
    {
      id: 'p2-med-2',
      medicineName: 'Metformin 500 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'After food',
      mealTimes: ['morning', 'noon', 'evening'],
      daysLeft: 4,
      endDateLabel: 'Mar 15',
      warningTone: 'critical',
    },
  ],
  p3: [
    {
      id: 'p3-med-1',
      medicineName: 'Donepezil 10 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'Before bedtime',
      mealTimes: ['bedtime'],
      daysLeft: 14,
      endDateLabel: null,
      warningTone: null,
    },
  ],
  p4: [
    {
      id: 'p4-med-1',
      medicineName: 'Furosemide 40 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'Morning dose',
      mealTimes: ['morning'],
      daysLeft: 2,
      endDateLabel: 'Mar 13',
      warningTone: 'critical',
    },
    {
      id: 'p4-med-2',
      medicineName: 'Losartan 50 mg',
      doseQuantity: 1,
      dosageForm: 'tablet',
      instructions: 'After breakfast',
      mealTimes: ['morning'],
      daysLeft: 9,
      endDateLabel: 'Mar 20',
      warningTone: 'warning',
    },
  ],
  p5: [
    {
      id: 'p5-med-1',
      medicineName: 'Calcium Carbonate',
      doseQuantity: 2,
      dosageForm: 'tablets',
      instructions: 'After lunch',
      mealTimes: ['noon'],
      daysLeft: 21,
      endDateLabel: null,
      warningTone: null,
    },
  ],
}

const DEFAULT_APPOINTMENTS: DetailPanelItem[] = [
  {
    id: 'appt-1',
    icon: 'calendar-outline',
    title: 'Medication review',
    subtitle: 'Ward A nurse station',
    meta: 'Fri, Mar 14 at 09:30',
    badge: 'Upcoming',
    badgeTone: 'success',
  },
  {
    id: 'appt-2',
    icon: 'clipboard-outline',
    title: 'Doctor follow-up',
    subtitle: 'Internal medicine clinic',
    meta: 'Tue, Mar 18 at 13:00',
    badge: 'Scheduled',
    badgeTone: 'neutral',
  },
]

const DEFAULT_DEVICES: DetailPanelItem[] = [
  {
    id: 'device-1',
    icon: 'cube-outline',
    title: 'Cabinet slot A-12',
    subtitle: 'Linked to the patient medication bin',
    meta: 'Last synced 2 minutes ago',
    badge: 'Connected',
    badgeTone: 'success',
  },
  {
    id: 'device-2',
    icon: 'scan-outline',
    title: 'Label scanner',
    subtitle: 'Ready for medication verification',
    meta: 'Battery 78%',
    badge: 'Ready',
    badgeTone: 'warning',
  },
]

function getAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDelta = today.getMonth() - dob.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }

  return age
}

function formatShortDate(dateValue: string | null): string | null {
  if (!dateValue) return null

  const value = new Date(dateValue)
  if (Number.isNaN(value.getTime())) return null

  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getDaysLeft(dateValue: string | null): number | null {
  if (!dateValue) return null

  const target = new Date(dateValue)
  if (Number.isNaN(target.getTime())) return null

  const now = new Date()
  const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const midnightTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime()

  return Math.max(0, Math.ceil((midnightTarget - midnightNow) / (1000 * 60 * 60 * 24)))
}

function getMedicationLabel(quantity: number, dosageForm: string | null) {
  const normalized = dosageForm?.toLowerCase() ?? ''
  const unit = normalized.includes('tablet') || normalized.includes('tab') ? 'tablet' : 'dose'
  return `${quantity} ${unit}${quantity === 1 ? '' : 's'}`
}

// Parse JSON schedule notes stored by the scanner into a human-readable label.
// Falls back to the raw string if it's plain text (not JSON).
function parseScheduleLabel(notes: string | null): string | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes) as {
      schedule_type?: string
      frequency_hours?: number
      times_per_day?: number
      meal_relation?: string
      raw_frequency?: string
    }
    const type = parsed.schedule_type
    if (type === 'interval_hours' && parsed.frequency_hours) {
      return parsed.frequency_hours === 24
        ? 'Once per day'
        : `Every ${parsed.frequency_hours} hours`
    }
    if (type === 'times_per_day' && parsed.times_per_day) {
      const n = parsed.times_per_day
      return n === 1 ? 'Once per day' : n === 2 ? 'Twice per day' : `${n}× per day`
    }
    if (type === 'meal_time' && parsed.meal_relation) {
      const rel: Record<string, string> = { before: 'Before meals', after: 'After meals', with: 'With meals', any: 'With / without food' }
      return rel[parsed.meal_relation] ?? 'With meals'
    }
    if (type === 'as_needed') return 'As needed (PRN)'
    // Fall back to raw_frequency text if type not recognized
    return parsed.raw_frequency ?? null
  } catch {
    // Notes is plain text, not JSON — show it directly
    return notes
  }
}

function buildMedicineName(name: string, strength: string | null) {
  return strength ? `${name} ${strength}` : name
}

function groupScheduleItems(items: ScheduleItem[]): DisplayMedication[] {
  const groups = new Map<string, ScheduleItem[]>()

  for (const item of items) {
    const current = groups.get(item.prescription_id) ?? []
    current.push(item)
    groups.set(item.prescription_id, current)
  }

  return Array.from(groups.entries()).map(([prescriptionId, groupedItems]) => {
    const first = groupedItems[0]
    const mealTimes = DISPLAY_MEALS.filter((mealTime) =>
      groupedItems.some((entry) => entry.meal_time === mealTime),
    )

    return {
      id: prescriptionId,
      medicineName: buildMedicineName(first.medicine_name, first.medicine_strength),
      doseQuantity: first.dose_quantity,
      dosageForm: first.dosage_form,
      instructions: first.notes,
      mealTimes,
      daysLeft: null,
      endDateLabel: null,
      warningTone: null,
    }
  })
}

function getWarningTone(daysLeft: number | null): WarningTone {
  if (daysLeft === null) return null
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'warning'
  return null
}

function Avatar({ photoUrl, name }: { photoUrl: string | null | undefined; name: string }) {
  return (
    <PatientAvatar name={name} photoUrl={photoUrl} size={92} borderWidth={3} borderColor="#FFFFFF">
      <View
        style={{
          position: 'absolute',
          bottom: 14,
          right: 14,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: '#FFFFFF',
          opacity: 0.25,
        }}
        accessible={false}
      />
      <Text
        style={{
          position: 'absolute',
          left: -9999,
          opacity: 0,
        }}
      >
        {name}
      </Text>
    </PatientAvatar>
  )
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#2F2E2D' }}>{value}</Text>
      <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 16, color: '#7E8797' }}>{label}</Text>
    </View>
  )
}

function MedicationChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 40,
        borderRadius: 10,
        borderWidth: active ? 2 : 1,
        borderColor: active ? '#16C7A4' : '#E5E5E5',
        backgroundColor: active ? '#DBF8F0' : '#F6F6F6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          fontWeight: active ? '600' : '500',
          color: active ? '#15B896' : '#979797',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function MedicationCard({
  medication,
  patientName,
  onDiscontinue,
  onRequestRefill,
}: {
  medication: DisplayMedication
  patientName: string
  onDiscontinue: (id: string, name: string) => void
  onRequestRefill: (medication: DisplayMedication) => void
}) {
  const warningBackground = medication.warningTone === 'critical' ? '#FDEEEF' : '#FFF7E9'
  const warningColor = medication.warningTone === 'critical' ? '#EF5D5D' : '#F3A24D'
  const warningIcon = medication.warningTone === 'critical' ? 'alert-circle' : 'warning'

  const stockPercent =
    medication.initialQuantity && medication.initialQuantity > 0 && medication.quantityRemaining !== null && medication.quantityRemaining !== undefined
      ? Math.max(0, Math.min(1, medication.quantityRemaining / medication.initialQuantity))
      : null
  const stockTone =
    stockPercent === null
      ? 'unknown'
      : stockPercent <= 0.15
        ? 'critical'
        : stockPercent <= 0.35
          ? 'warning'
          : 'ok'
  const stockBarColor =
    stockTone === 'critical' ? '#EF5D5D' : stockTone === 'warning' ? '#F3A24D' : '#27B07A'

  const showMedicationActions = () => {
    Alert.alert(medication.medicineName, 'Choose an action for this medication.', [
      {
        text: 'Request refill',
        onPress: () => onRequestRefill(medication),
      },
      {
        text: 'Discontinue',
        style: 'destructive',
        onPress: () => onDiscontinue(medication.id, medication.medicineName),
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleSetReminder = () => {
    const daysLeft = medication.daysLeft ?? 0
    const remindIn = Math.max(daysLeft - 1, 1)
    Alert.alert(
      'Set reminder',
      `Notify in ${remindIn} day(s) that ${medication.medicineName} is running low?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const id = await scheduleRefillReminder({
              medicineName: medication.medicineName,
              daysFromNow: remindIn,
              patientName,
            })
            if (id) {
              Alert.alert('Reminder set', `You'll be reminded in ${remindIn} day(s).`)
            } else {
              Alert.alert(
                'Permission needed',
                'Enable notifications in Settings to schedule reminders.',
              )
            }
          },
        },
      ],
    )
  }

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
        shadowColor: '#D7CCBB',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 21,
              fontWeight: '700',
              color: '#2F2E2D',
            }}
            numberOfLines={1}
          >
            {medication.medicineName}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <HealthIcon width={13} height={13} color="#7E8797" />
            <Text style={{ marginLeft: 5, fontSize: 13, lineHeight: 18, color: '#727C8F' }}>
              {getMedicationLabel(medication.doseQuantity, medication.dosageForm)}
            </Text>
          </View>
          {(() => {
            const scheduleLabel = parseScheduleLabel(medication.instructions)
            return scheduleLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <Ionicons name="time-outline" size={13} color="#7E8797" />
                <Text style={{ marginLeft: 5, fontSize: 13, lineHeight: 18, color: '#727C8F' }}>
                  {scheduleLabel}
                </Text>
              </View>
            ) : null
          })()}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${medication.medicineName}`}
          onPress={showMedicationActions}
          hitSlop={8}
          style={{
            minWidth: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -2,
            marginRight: -4,
          }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#4C4845" />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
        {DISPLAY_MEALS.map((mealTime) => (
          <MedicationChip
            key={mealTime}
            label={MEAL_LABELS[mealTime]}
            active={medication.mealTimes.includes(mealTime)}
          />
        ))}
      </View>

      {stockPercent !== null ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: '#7E8797', fontWeight: '600', letterSpacing: 0.5 }}>
              STOCK
            </Text>
            <Text style={{ fontSize: 11, color: stockBarColor, fontWeight: '700' }}>
              {medication.quantityRemaining} / {medication.initialQuantity}
              {stockTone === 'critical' ? '  ·  Refill soon' : ''}
            </Text>
          </View>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: '#F1ECE5',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(stockPercent * 100)}%`,
                height: '100%',
                backgroundColor: stockBarColor,
              }}
            />
          </View>
        </View>
      ) : null}

      {medication.warningTone ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 12,
            backgroundColor: warningBackground,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={warningIcon} size={16} color={warningColor} />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 13,
                  lineHeight: 18,
                  fontWeight: '700',
                  color: warningColor,
                }}
              >
                {medication.daysLeft} days left
                {medication.endDateLabel ? ` · Ends on ${medication.endDateLabel}` : ''}
              </Text>
            </View>

            <Text
              style={{
                marginTop: 3,
                marginLeft: 22,
                fontSize: 11,
                lineHeight: 15,
                color: '#6F7582',
              }}
            >
              Medication will run out before the next refill
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSetReminder}
            hitSlop={8}
            style={{
              minHeight: 48,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#E5E3DE',
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3938' }}>Set Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : medication.daysLeft !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Ionicons name="time-outline" size={15} color="#2F2E2D" />
          <Text style={{ marginLeft: 6, fontSize: 13, lineHeight: 18, color: '#3A3938' }}>
            {medication.daysLeft} days left
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function DetailInfoCard({ item }: { item: DetailPanelItem }) {
  const badgeBackground = item.badgeTone === 'success'
    ? '#E6FBF5'
    : item.badgeTone === 'warning'
      ? '#FFF0DB'
      : '#F0F2F5'
  const badgeColor = item.badgeTone === 'success'
    ? '#0FB38D'
    : item.badgeTone === 'warning'
      ? '#E89A35'
      : '#687385'

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 18,
        shadowColor: '#D7CCBB',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 14 },
        shadowRadius: 26,
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: '#FFF4E2',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          <Ionicons name={item.icon} size={22} color="#EFA247" />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D', flex: 1, paddingRight: 12 }}>
              {item.title}
            </Text>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: badgeBackground,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: badgeColor }}>
                {item.badge}
              </Text>
            </View>
          </View>

          <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: '#727C8F' }}>{item.subtitle}</Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: '#9AA2B1' }}>{item.meta}</Text>
        </View>
      </View>
    </View>
  )
}

function ScreenEmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
}) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        paddingHorizontal: 24,
        paddingVertical: 34,
        alignItems: 'center',
        shadowColor: '#D7CCBB',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 24,
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFF4E2',
        }}
      >
        <Ionicons name={icon} size={28} color="#EFA247" />
      </View>
      <Text style={{ marginTop: 18, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D' }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: 20,
          color: '#7E8797',
          textAlign: 'center',
        }}
      >
        {body}
      </Text>
    </View>
  )
}

function formatHistoryDateBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDelta = Math.round((startOfToday - startOfThat) / (1000 * 60 * 60 * 24))
  if (dayDelta === 0) return 'Today'
  if (dayDelta === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatHistoryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function HistoryStatusPill({ status }: { status: LogStatus }) {
  const tone =
    status === 'confirmed'
      ? { bg: '#E6FBF5', fg: '#0FB38D', label: 'Confirmed' }
      : status === 'refused'
        ? { bg: '#FDEEEF', fg: '#EF5D5D', label: 'Refused' }
        : { bg: '#F0F2F5', fg: '#687385', label: 'Skipped' }
  return (
    <View
      style={{
        borderRadius: 999,
        backgroundColor: tone.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: tone.fg }}>{tone.label}</Text>
    </View>
  )
}

function MedicationHistoryList({ entries }: { entries: MedicationHistoryEntry[] }) {
  const buckets = new Map<string, MedicationHistoryEntry[]>()
  for (const entry of entries) {
    const key = formatHistoryDateBucket(entry.administered_at)
    const existing = buckets.get(key) ?? []
    existing.push(entry)
    buckets.set(key, existing)
  }

  return (
    <View style={{ gap: 18 }}>
      {Array.from(buckets.entries()).map(([bucket, rows]) => (
        <View key={bucket} style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#7E8797', letterSpacing: 0.5 }}>
            {bucket.toUpperCase()}
          </Text>
          {rows.map((entry) => {
            const medicineLabel = buildMedicineName(entry.medicine_name, entry.medicine_strength)
            const methodLabel = entry.method !== 'normal' ? ` · ${entry.method.replace('_', ' ')}` : ''
            const subline = entry.refusal_reason
              ? entry.refusal_reason
              : entry.notes
                ? entry.notes
                : null
            return (
              <View
                key={entry.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  shadowColor: '#D7CCBB',
                  shadowOpacity: 0.18,
                  shadowOffset: { width: 0, height: 6 },
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#3A3938' }}>
                    {formatHistoryTime(entry.administered_at)} · {entry.meal_time}
                    {methodLabel}
                  </Text>
                  <HistoryStatusPill status={entry.status} />
                </View>
                <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#2F2E2D' }} numberOfLines={1}>
                  {medicineLabel}
                </Text>
                {subline ? (
                  <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 17, color: '#7E8797' }}>{subline}</Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export default function PatientDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; tab?: string | string[] }>()
  const router = useRouter()
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab: DetailTab =
    tabParam === 'history' || tabParam === 'appointments' || tabParam === 'device' || tabParam === 'medications'
      ? tabParam
      : 'medications'
  const { selectedPatient, loading, fetchPatientDetail } = usePatientStore()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule } = useMedicationStore()

  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)
  const [prescriptions, setPrescriptions] = useState<LivePrescription[]>([])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)
  const [cabinetSlots, setCabinetSlots] = useState<CabinetSlotInfo[]>([])
  const [historyEntries, setHistoryEntries] = useState<MedicationHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!patientId) return

    const currentPatientId = patientId
    const today = new Date().toISOString().slice(0, 10)

    async function load() {
      if (USE_MOCK) {
        mockSelectPatient(currentPatientId)
      } else {
        await fetchPatientDetail(currentPatientId)
      }

      if (user?.ward_id) {
        await fetchSchedule(user.ward_id, today)
      }

      if (!USE_MOCK) {
        setPrescriptionsLoading(true)

        const { data, error } = await supabase
          .from('patient_prescriptions')
          .select(`
            id,
            patient_id,
            medicine_id,
            dose_quantity,
            meal_times,
            notes,
            start_date,
            end_date,
            medicines (
              id,
              name,
              strength,
              dosage_form
            )
          `)
          .eq('patient_id', currentPatientId)
          .eq('is_active', true)
          .order('start_date', { ascending: false })

        if (!error) {
          setPrescriptions((data ?? []) as unknown as LivePrescription[])
        }

        const { data: slots } = await supabase
          .from('cabinet_slots')
          .select(`
            id,
            cabinet_position,
            partition,
            quantity_remaining,
            initial_quantity,
            expiry_date,
            medicines (
              name,
              strength
            )
          `)
          .eq('patient_id', currentPatientId)
          .order('cabinet_position', { ascending: true })

        const mapped: CabinetSlotInfo[] = ((slots ?? []) as unknown as Array<
          Omit<CabinetSlotInfo, 'medicine'> & {
            medicines: { name: string; strength: string | null } | null
          }
        >).map((row) => ({
          id: row.id,
          cabinet_position: row.cabinet_position,
          partition: row.partition,
          quantity_remaining: row.quantity_remaining,
          initial_quantity: row.initial_quantity,
          expiry_date: row.expiry_date,
          medicine: row.medicines,
        }))
        setCabinetSlots(mapped)

        setPrescriptionsLoading(false)
      }
    }

    void load()
  }, [fetchPatientDetail, fetchSchedule, patientId, user?.ward_id, refreshTick])

  useEffect(() => {
    if (!patientId || activeTab !== 'history') return

    if (USE_MOCK) {
      setHistoryEntries(MOCK_HISTORY)
      return
    }

    let cancelled = false
    const currentPatientId = patientId
    setHistoryLoading(true)

    supabase
      .from('medication_logs')
      .select(`
        id,
        administered_at,
        meal_time,
        status,
        method,
        refusal_reason,
        notes,
        medicines (
          name,
          strength
        )
      `)
      .eq('patient_id', currentPatientId)
      .order('administered_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setHistoryEntries([])
        } else {
          const mapped: MedicationHistoryEntry[] = (data ?? []).map((row) => {
            const medicine = (row as { medicines?: { name?: string; strength?: string | null } | null }).medicines
            return {
              id: row.id as string,
              administered_at: row.administered_at as string,
              meal_time: row.meal_time as MealTime,
              status: row.status as LogStatus,
              method: row.method as LogMethod,
              refusal_reason: (row.refusal_reason as string | null) ?? null,
              notes: (row.notes as string | null) ?? null,
              medicine_name: medicine?.name ?? 'Medication',
              medicine_strength: medicine?.strength ?? null,
            }
          })
          setHistoryEntries(mapped)
        }
        setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, patientId, refreshTick])

  const handleDiscontinuePrescription = async (prescriptionId: string, medicineName: string) => {
    Alert.alert(
      'Discontinue medication',
      `Stop ${medicineName}? It will be hidden from the active list. You can re-add it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discontinue',
          style: 'destructive',
          onPress: async () => {
            if (USE_MOCK) {
              Alert.alert('Mock mode', 'Discontinue would update patient_prescriptions in live mode.')
              return
            }
            const { error } = await supabase
              .from('patient_prescriptions')
              .update({ is_active: false })
              .eq('id', prescriptionId)
            if (error) {
              Alert.alert('Error', error.message)
              return
            }
            setRefreshTick((tick) => tick + 1)
          },
        },
      ],
    )
  }

  const demoPatient = patientId ? DEMO_PATIENTS[patientId] : null
  const storePatient = selectedPatient?.id === patientId ? selectedPatient : null
  const resolvedPatient = storePatient ?? null

  if ((loading || prescriptionsLoading) && !resolvedPatient && !demoPatient) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F2EA', alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#EFA247" />
      </SafeAreaView>
    )
  }

  if (!resolvedPatient && !demoPatient) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F2EA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenEmptyState
          icon="person-outline"
          title="Patient not found"
          body="The detail record could not be loaded. Go back and reopen the patient from the ward list."
        />
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            minHeight: 48,
            borderRadius: 999,
            paddingHorizontal: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EFA247',
          }}
        >
          <Text style={{ color: '#2F2E2D', fontSize: 15, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const patientName = resolvedPatient?.name ?? demoPatient?.name ?? 'Patient'
  const roomNumber = resolvedPatient?.room_number ?? demoPatient?.room_number ?? 'A-101'
  const age = getAge(resolvedPatient?.date_of_birth ?? null) ?? demoPatient?.age ?? null
  const heroMedicationCount = demoPatient?.heroMedicationCount ?? prescriptions.length
  const photoUrl = resolvedPatient?.photo_url ?? demoPatient?.photo_url ?? null

  const patientScheduleItems = scheduleGroups
    .flatMap((group) => group.items)
    .filter((item) => item.patient_id === patientId)

  const liveMedications: DisplayMedication[] = prescriptions.map((prescription) => {
    const daysLeft = getDaysLeft(prescription.end_date)
    const expectedName = buildMedicineName(
      prescription.medicines?.name ?? '',
      prescription.medicines?.strength ?? null,
    )
    const slot = cabinetSlots.find(
      (s) => s.medicine && buildMedicineName(s.medicine.name, s.medicine.strength) === expectedName,
    )

    return {
      id: prescription.id,
      medicineId: prescription.medicine_id,
      medicineName: buildMedicineName(
        prescription.medicines?.name ?? 'Medication',
        prescription.medicines?.strength ?? null,
      ),
      doseQuantity: prescription.dose_quantity,
      dosageForm: prescription.medicines?.dosage_form ?? 'tablet',
      instructions: prescription.notes,
      mealTimes: prescription.meal_times,
      daysLeft,
      endDateLabel: formatShortDate(prescription.end_date),
      warningTone: getWarningTone(daysLeft),
      quantityRemaining: slot?.quantity_remaining ?? null,
      initialQuantity: slot?.initial_quantity ?? null,
    }
  })

  const groupedScheduleMedications = groupScheduleItems(
    patientScheduleItems.length > 0
      ? patientScheduleItems
      : (MOCK_PRESCRIPTIONS as ScheduleItem[]).filter((item) => item.patient_id === patientId),
  )

  const displayMedications = liveMedications.length > 0
    ? liveMedications
    : groupedScheduleMedications.length > 0
      ? groupedScheduleMedications
      : patientId && DEMO_MEDICATIONS[patientId]
        ? DEMO_MEDICATIONS[patientId]
        : []

  const statType = demoPatient?.statType ?? displayMedications.length
  const statDosePerDay = demoPatient?.statDosePerDay ?? displayMedications.reduce(
    (total, medication) => total + (medication.doseQuantity * medication.mealTimes.length),
    0,
  )
  const statEndDate = demoPatient?.statEndDate ?? displayMedications.filter(
    (medication) => medication.endDateLabel || medication.warningTone,
  ).length

  const HistoryTabIcon: React.FC<{ width?: number; height?: number; color?: string }> = ({
    width = 22,
    height = 22,
    color = '#2F2E2D',
  }) => <Ionicons name="time-outline" size={Math.max(width, height)} color={color} />

  const detailTabs: Array<{
    key: DetailTab
    label: string
    Icon: React.FC<{ width?: number; height?: number; color?: string }>
  }> = [
    { key: 'medications', label: 'Medication', Icon: MedicineIcon },
    { key: 'history', label: 'History', Icon: HistoryTabIcon },
    { key: 'appointments', label: 'Appointments', Icon: AppointmentIcon },
    { key: 'device', label: 'Device', Icon: DetailsIcon },
  ]

  const appointments = DEFAULT_APPOINTMENTS.map((item, index) => ({
    ...item,
    id: `${item.id}-${patientId ?? 'patient'}`,
    subtitle: index === 0 ? `${patientName} medication follow-up` : item.subtitle,
  }))

  const liveDeviceItems: DetailPanelItem[] = cabinetSlots.map((slot) => {
    const remaining = slot.quantity_remaining ?? 0
    const initial = slot.initial_quantity ?? 0
    const ratio = initial > 0 ? remaining / initial : null
    const tone: DetailPanelItem['badgeTone'] =
      ratio === null
        ? 'neutral'
        : ratio <= 0.15
          ? 'warning'
          : ratio <= 0.35
            ? 'warning'
            : 'success'
    const badge =
      ratio === null
        ? `${remaining} left`
        : ratio <= 0.15
          ? 'Low'
          : ratio <= 0.35
            ? 'Watch'
            : 'OK'
    const expiryLabel = slot.expiry_date
      ? `Expires ${formatShortDate(slot.expiry_date) ?? slot.expiry_date}`
      : 'No expiry on file'
    const medicineLabel = slot.medicine
      ? buildMedicineName(slot.medicine.name, slot.medicine.strength)
      : 'Unassigned medicine'
    return {
      id: `device-${slot.id}`,
      icon: 'cube-outline' as const,
      title: `Slot #${slot.cabinet_position} · ${slot.partition}`,
      subtitle: medicineLabel,
      meta: `${remaining}${initial > 0 ? ` / ${initial}` : ''} units · ${expiryLabel}`,
      badge,
      badgeTone: tone,
    }
  })

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F2EA' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#F9E1BE', '#F5BC77', '#ECA44E']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingBottom: 72,
          overflow: 'hidden',
        }}
      >
        <SafeAreaView edges={['top']}>
          <View
            style={{
              position: 'absolute',
              top: -26,
              left: -54,
              width: 164,
              height: 164,
              borderRadius: 82,
              backgroundColor: '#FFF3DE',
              opacity: 0.3,
            }}
            accessible={false}
          />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: -20,
              width: 176,
              height: 176,
              borderRadius: 88,
              backgroundColor: '#FFD9A8',
              opacity: 0.34,
            }}
            accessible={false}
          />
          <View
            style={{
              position: 'absolute',
              right: 34,
              top: 22,
              width: 114,
              height: 114,
              borderRadius: 57,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.28)',
            }}
            accessible={false}
          />

          <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
            <View style={{ position: 'relative', minHeight: 44, justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={28} color="#2F2E2D" />
              </TouchableOpacity>

              <Text
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  fontSize: 18,
                  lineHeight: 24,
                  fontWeight: '500',
                  color: '#2F2E2D',
                }}
              >
                Patients Detail
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Patient actions for ${patientName}`}
                onPress={() => {
                  if (!patientId) return
                  Alert.alert(patientName, 'Choose an action.', [
                    {
                      text: 'รายงานครอบครัว / Daily family update',
                      onPress: () =>
                        router.push({
                          pathname: '/daily-update',
                          params: { patientId, patientName },
                        }),
                    },
                    {
                      text: '🚨 Emergency: Notify Family via LINE',
                      onPress: () =>
                        router.push({
                          pathname: '/notify-family',
                          params: { patientId, patientName },
                        }),
                    },
                    {
                      text: 'Manage Family Contacts',
                      onPress: () =>
                        router.push({
                          pathname: '/family-contacts',
                          params: { patientId, patientName },
                        }),
                    },
                    {
                      text: 'Hospital Visit Reminder',
                      onPress: () =>
                        router.push({
                          pathname: '/hospital-visit',
                          params: { patientId, patientName },
                        }),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#2F2E2D" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                marginTop: 22,
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Text
                  style={{
                    fontSize: 18,
                    lineHeight: 24,
                    fontWeight: '700',
                    color: '#2F2E2D',
                  }}
                  numberOfLines={2}
                >
                  {patientName}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Ionicons name="cube-outline" size={15} color="#2F2E2D" />
                  <Text style={{ marginLeft: 7, fontSize: 13, lineHeight: 18, color: '#2F2E2D' }}>
                    Room {roomNumber}
                    {age !== null ? ` • Age ${age}` : ''}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <HealthIcon width={15} height={15} color="#2F2E2D" />
                  <Text style={{ marginLeft: 7, fontSize: 13, lineHeight: 18, color: '#2F2E2D' }}>
                    {heroMedicationCount} tablets
                  </Text>
                </View>
              </View>

              <Image
                source={ProfileBoyIcon}
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  borderWidth: 3,
                  borderColor: '#FFFFFF',
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ImageBackground
        source={FrameIcon}
        style={{
          marginTop: -74,
          marginHorizontal: 50,
          height: 116,
          borderRadius: 28,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
          shadowColor: '#D7CCBB',
          shadowOpacity: 0.22,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
          elevation: 4,
        }}
        imageStyle={{ borderRadius: 28, resizeMode: 'stretch' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'stretch', flex: 1 }}>
          <StatBlock value={statType} label="Type" />
          <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
          <StatBlock value={statDosePerDay} label="Dose/Day" />
          <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
          <StatBlock value={statEndDate} label="End Date" />
        </View>
      </ImageBackground>

      <View style={{ paddingHorizontal: 8, marginTop: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab.key
            const TabIcon = tab.Icon

            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
                style={{
                  flex: 1,
                  minHeight: 56,
                  paddingHorizontal: 4,
                  paddingVertical: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? '#F1A34A' : 'transparent',
                }}
              >
                <TabIcon width={18} height={18} color={isActive ? '#F1A34A' : '#2F2E2D'} />
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    lineHeight: 14,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#F1A34A' : '#2F2E2D',
                    textAlign: 'center',
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: activeTab === 'medications' ? 144 : 40,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'medications' && displayMedications.length === 0 ? (
          <ScreenEmptyState
            icon="medkit-outline"
            title="No medication records"
            body="Add medication to this patient or wait for the daily schedule to sync."
          />
        ) : null}

        {activeTab === 'medications' && displayMedications.map((medication) => (
          <MedicationCard
            key={medication.id}
            medication={medication}
            patientName={patientName}
            onDiscontinue={handleDiscontinuePrescription}
            onRequestRefill={(med) => {
              Alert.alert(
                'Request refill',
                `Send a refill request for ${med.medicineName} (${patientName})?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Request',
                    onPress: async () => {
                      if (USE_MOCK) {
                        Alert.alert('Mock mode', 'Refill request would be queued in live mode.')
                        return
                      }
                      const { error } = await supabase.from('prescription_changes').insert({
                        prescription_id: med.id,
                        change_type: 'modified',
                        new_json: { kind: 'refill_request', medicine: med.medicineName, requested_by: user?.id ?? null },
                        changed_by: user?.id ?? '',
                      })
                      if (error) {
                        Alert.alert('Could not file refill request', error.message)
                      } else {
                        Alert.alert('Refill requested', 'A refill request has been logged.')
                      }
                    },
                  },
                ],
              )
            }}
          />
        ))}

        {activeTab === 'appointments' && (
          appointments.length > 0 ? (
            appointments.map((item) => <DetailInfoCard key={item.id} item={item} />)
          ) : (
            <ScreenEmptyState
              icon="calendar-outline"
              title="No upcoming appointments"
              body="Hospital visits scheduled for this patient will appear here. Wire up your hospital booking system to populate this tab."
            />
          )
        )}

        {activeTab === 'device' && (
          liveDeviceItems.length > 0 ? (
            liveDeviceItems.map((item) => <DetailInfoCard key={item.id} item={item} />)
          ) : (
            <ScreenEmptyState
              icon="cube-outline"
              title="No cabinet slots assigned"
              body="When a PILLo cabinet slot is allocated to this patient, it will show up here with quantity, partition, and expiry."
            />
          )
        )}

        {activeTab === 'history' && (() => {
          if (historyLoading) {
            return (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color="#EFA247" />
              </View>
            )
          }
          if (historyEntries.length === 0) {
            return (
              <ScreenEmptyState
                icon="time-outline"
                title="No medication history yet"
                body="Past doses for this patient will appear here once medication logs are recorded."
              />
            )
          }
          return <MedicationHistoryList entries={historyEntries} />
        })()}
      </ScrollView>

      {activeTab === 'medications' ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 96,
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 12,
            backgroundColor: '#F7F2EA',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (!patientId) return
              router.push({
                pathname: '/dispense-fill/load/[patientId]',
                params: { patientId, patientName },
              })
            }}
            style={{
              minHeight: 46,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: '#F6AA4D',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              marginBottom: 10,
            }}
          >
            <Ionicons name="cube-outline" size={16} color="#C96B1A" />
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#C96B1A', marginLeft: 6 }}>
              Weekly Fill — load cabinet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (!patientId) return
              router.push({
                pathname: '/add-medication',
                params: {
                  patientId,
                  patientName,
                },
              })
            }}
            style={{
              minHeight: 58,
              borderRadius: 999,
              backgroundColor: '#F6AA4D',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#D59B4A',
              shadowOpacity: 0.32,
              shadowOffset: { width: 0, height: 12 },
              shadowRadius: 18,
              elevation: 5,
            }}
          >
            <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '500', color: '#2F2E2D' }}>
              + Add Medication
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE5DB', paddingHorizontal: 32, paddingTop: 12, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ alignItems: 'center', minWidth: 76 }}>
            <HomeIcon width={30} height={30} color="#2F2F2F" />
            <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)/patients')} style={{ alignItems: 'center', minWidth: 76 }}>
            <WardIcon width={30} height={30} color="#2F2F2F" />
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#2F2F2F', marginTop: 6 }}>Ward</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)/settings')} style={{ alignItems: 'center', minWidth: 76 }}>
            <ProfileIcon width={30} height={30} color="#2F2F2F" />
            <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Profile</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 6, width: 128, borderRadius: 999, alignSelf: 'center', marginTop: 16 }} />
      </View>
    </View>
  )
}
