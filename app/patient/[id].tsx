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
import type { MealTime } from '../../src/types/database'
import { PatientAvatar } from '../../src/components/shared/PatientAvatar'
import HomeIcon from '../../icons/Home.svg'
import WardIcon from '../../icons/Ward.svg'
import ProfileIcon from '../../icons/Profile.svg'
import MedicineIcon from '../../icons/Medicine.svg'
import HealthIcon from '../../icons/Health.svg'
import AppointmentIcon from '../../icons/Appointment.svg'
import DetailsIcon from '../../icons/Details.svg'

type DetailTab = 'medications' | 'appointments' | 'device'
type WarningTone = 'critical' | 'warning' | null

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
  medicineName: string
  doseQuantity: number
  dosageForm: string | null
  instructions: string | null
  mealTimes: MealTime[]
  daysLeft: number | null
  endDateLabel: string | null
  warningTone: WarningTone
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

function MedicationCard({ medication }: { medication: DisplayMedication }) {
  const warningBackground = medication.warningTone === 'critical' ? '#FDEEEF' : '#FFF7E9'
  const warningColor = medication.warningTone === 'critical' ? '#EF5D5D' : '#F3A24D'
  const warningIcon = medication.warningTone === 'critical' ? 'alert-circle' : 'warning'

  const showMedicationActions = () => {
    Alert.alert(medication.medicineName, 'Choose an action for this medication.', [
      { text: 'View schedule', onPress: () => {} },
      { text: 'Mark as dispensed', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleSetReminder = () => {
    Alert.alert(
      'Set reminder',
      `Notify ${medication.daysLeft ?? 0} day(s) before ${medication.medicineName} runs out?`,
      [
        { text: 'Confirm', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
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

export default function PatientDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const router = useRouter()
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id
  const { selectedPatient, loading, fetchPatientDetail } = usePatientStore()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule } = useMedicationStore()

  const [activeTab, setActiveTab] = useState<DetailTab>('medications')
  const [prescriptions, setPrescriptions] = useState<LivePrescription[]>([])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)

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

        setPrescriptionsLoading(false)
      }
    }

    void load()
  }, [fetchPatientDetail, fetchSchedule, patientId, user?.ward_id])

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

    return {
      id: prescription.id,
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

  const detailTabs: Array<{
    key: DetailTab
    label: string
    Icon: React.FC<{ width?: number; height?: number; color?: string }>
  }> = [
    { key: 'medications', label: 'Medication', Icon: MedicineIcon },
    { key: 'appointments', label: 'Appointments', Icon: AppointmentIcon },
    { key: 'device', label: 'Device', Icon: DetailsIcon },
  ]

  const appointments = DEFAULT_APPOINTMENTS.map((item, index) => ({
    ...item,
    id: `${item.id}-${patientId ?? 'patient'}`,
    subtitle: index === 0 ? `${patientName} medication follow-up` : item.subtitle,
  }))

  const devices = DEFAULT_DEVICES.map((item, index) => ({
    ...item,
    id: `${item.id}-${patientId ?? 'patient'}`,
    subtitle: index === 0 ? `Assigned to Room ${roomNumber}` : item.subtitle,
  }))

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

              <Avatar photoUrl={photoUrl} name={patientName} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View
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
      >
        <View style={{ flexDirection: 'row', alignItems: 'stretch', flex: 1 }}>
          <StatBlock value={statType} label="Type" />
          <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
          <StatBlock value={statDosePerDay} label="Dose/Day" />
          <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
          <StatBlock value={statEndDate} label="End Date" />
        </View>
      </View>

      <View style={{ paddingHorizontal: 18, marginTop: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {detailTabs.map((tab) => {
            const isActive = activeTab === tab.key
            const TabIcon = tab.Icon

            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  minHeight: 54,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottomWidth: 3,
                  borderBottomColor: isActive ? '#F1A34A' : 'transparent',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <TabIcon width={22} height={22} color={isActive ? '#F1A34A' : '#2F2E2D'} />
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 22,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? '#F1A34A' : '#2F2E2D',
                  }}
                  numberOfLines={1}
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
          <MedicationCard key={medication.id} medication={medication} />
        ))}

        {activeTab === 'appointments' && appointments.map((item) => (
          <DetailInfoCard key={item.id} item={item} />
        ))}

        {activeTab === 'device' && devices.map((item) => (
          <DetailInfoCard key={item.id} item={item} />
        ))}
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
