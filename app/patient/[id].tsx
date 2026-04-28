/**
 * app/patient/[id].tsx
 * Patient detail screen — data fetching + state only.
 *
 * UI components live in src/components/patient/:
 *   types.ts                 → shared types, constants, buildMedicineName
 *   PatientHeader.tsx        → orange gradient top section
 *   PatientStatBar.tsx       → Type / Dose/Day / End Date stat card
 *   MedicationCard.tsx       → one medication row (chips, stock bar, warning)
 *   MedicationHistoryList.tsx → history grouped by date
 *   DetailInfoCard.tsx       → appointment or device row
 */

import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { usePatientStore } from '../../src/stores/patientStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleItem } from '../../src/stores/medicationStore'
import { USE_MOCK, MOCK_PRESCRIPTIONS, mockSelectPatient } from '../../src/mocks'
import { supabase } from '../../src/lib/supabase'
import type { LogMethod, LogStatus, MealTime } from '../../src/types/database'
import HomeIcon from '../../icons/Home.svg'
import WardIcon from '../../icons/Ward.svg'
import ProfileIcon from '../../icons/Profile.svg'
import MedicineIcon from '../../icons/Medicine.svg'
import AppointmentIcon from '../../icons/Appointment.svg'
import DetailsIcon from '../../icons/Details.svg'

import { PatientHeader }          from '../../src/components/patient/PatientHeader'
import { PatientStatBar }         from '../../src/components/patient/PatientStatBar'
import { MedicationCard }         from '../../src/components/patient/MedicationCard'
import { MedicationHistoryList }  from '../../src/components/patient/MedicationHistoryList'
import { DetailInfoCard }         from '../../src/components/patient/DetailInfoCard'
import {
  type DetailTab,
  type DisplayMedication,
  type DetailPanelItem,
  type MedicationHistoryEntry,
  type TabDef,
  DISPLAY_MEALS,
  buildMedicineName,
} from '../../src/components/patient/types'

// ─── Screen-local types ───────────────────────────────────────────────────────

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
  medicines: { id: string; name: string; strength: string | null; dosage_form: string | null } | null
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

// ─── Mock / static data ───────────────────────────────────────────────────────

const MOCK_HISTORY: MedicationHistoryEntry[] = [
  { id: 'mock-h-1', administered_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),  meal_time: 'noon',    status: 'confirmed', method: 'normal',  refusal_reason: null,              notes: 'Taken with water after lunch', medicine_name: 'Amlodipine',  medicine_strength: '5 mg' },
  { id: 'mock-h-2', administered_at: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),  meal_time: 'morning', status: 'refused',   method: 'normal',  refusal_reason: 'Patient refused', notes: null,                           medicine_name: 'Metformin',   medicine_strength: '500 mg' },
  { id: 'mock-h-3', administered_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), meal_time: 'bedtime', status: 'confirmed', method: 'crushed', refusal_reason: null,              notes: null,                           medicine_name: 'Risperidone', medicine_strength: '2 mg' },
  { id: 'mock-h-4', administered_at: new Date(Date.now() - 1000 * 60 * 60 * 33).toISOString(), meal_time: 'evening', status: 'skipped',   method: 'normal',  refusal_reason: null,              notes: 'NPO before procedure',         medicine_name: 'Metoprolol',  medicine_strength: '25 mg' },
]

const DEMO_PATIENTS: Record<string, DemoPatientDetail> = {
  p1: { id: 'p1', name: 'Mrs. Somsri Phakrammongkol',  room_number: 'A-101', age: 79, heroMedicationCount: 9,  statType: 16, statDosePerDay: 12, statEndDate: 4 },
  p2: { id: 'p2', name: 'Mrs. Somchai Rungreang',       room_number: 'A-102', age: 79, heroMedicationCount: 12, statType: 16, statDosePerDay: 12, statEndDate: 3 },
  p3: { id: 'p3', name: 'Mr. Mana Jai',                 room_number: 'B-203', age: 69, heroMedicationCount: 5,  statType: 10, statDosePerDay: 8,  statEndDate: 1 },
  p4: { id: 'p4', name: 'Mrs. Dararat Prasartngam',     room_number: 'B-204', age: 80, heroMedicationCount: 11, statType: 15, statDosePerDay: 11, statEndDate: 5 },
  p5: { id: 'p5', name: 'Mrs. Kanya Singkow',           room_number: 'B-205', age: 67, heroMedicationCount: 12, statType: 13, statDosePerDay: 10, statEndDate: 2 },
}

const DEMO_MEDICATIONS: Record<string, DisplayMedication[]> = {
  p1: [
    { id: 'p1-med-1', medicineName: 'Amlodipine 5 mg',   doseQuantity: 1, dosageForm: 'tablet', instructions: 'Before bedtime',  mealTimes: ['morning'],                           daysLeft: 3,  endDateLabel: 'Mar 14', warningTone: 'critical' },
    { id: 'p1-med-2', medicineName: 'Metoprolol 25 mg',  doseQuantity: 1, dosageForm: 'tablet', instructions: 'Before bedtime',  mealTimes: ['morning','noon','evening','bedtime'], daysLeft: 25, endDateLabel: null,      warningTone: null },
    { id: 'p1-med-3', medicineName: 'Risperidone 2 mg',  doseQuantity: 1, dosageForm: 'tablet', instructions: 'After food',      mealTimes: ['morning','bedtime'],                 daysLeft: 10, endDateLabel: 'Mar 14', warningTone: 'warning' },
  ],
  p2: [
    { id: 'p2-med-1', medicineName: 'Aspirin 81 mg',     doseQuantity: 1, dosageForm: 'tablet', instructions: 'After breakfast', mealTimes: ['morning'],                           daysLeft: 18, endDateLabel: null,      warningTone: null },
    { id: 'p2-med-2', medicineName: 'Metformin 500 mg',  doseQuantity: 1, dosageForm: 'tablet', instructions: 'After food',      mealTimes: ['morning','noon','evening'],           daysLeft: 4,  endDateLabel: 'Mar 15', warningTone: 'critical' },
  ],
  p3: [{ id: 'p3-med-1', medicineName: 'Donepezil 10 mg',   doseQuantity: 1, dosageForm: 'tablet',  instructions: 'Before bedtime', mealTimes: ['bedtime'],          daysLeft: 14, endDateLabel: null,      warningTone: null }],
  p4: [
    { id: 'p4-med-1', medicineName: 'Furosemide 40 mg',  doseQuantity: 1, dosageForm: 'tablet', instructions: 'Morning dose',    mealTimes: ['morning'],                           daysLeft: 2,  endDateLabel: 'Mar 13', warningTone: 'critical' },
    { id: 'p4-med-2', medicineName: 'Losartan 50 mg',    doseQuantity: 1, dosageForm: 'tablet', instructions: 'After breakfast', mealTimes: ['morning'],                           daysLeft: 9,  endDateLabel: 'Mar 20', warningTone: 'warning' },
  ],
  p5: [{ id: 'p5-med-1', medicineName: 'Calcium Carbonate', doseQuantity: 2, dosageForm: 'tablets', instructions: 'After lunch',    mealTimes: ['noon'],             daysLeft: 21, endDateLabel: null,      warningTone: null }],
}

const DEFAULT_APPOINTMENTS: DetailPanelItem[] = [
  { id: 'appt-1', icon: 'calendar-outline',  title: 'Medication review', subtitle: 'Ward A nurse station',     meta: 'Fri, Mar 14 at 09:30', badge: 'Upcoming',  badgeTone: 'success' },
  { id: 'appt-2', icon: 'clipboard-outline', title: 'Doctor follow-up',  subtitle: 'Internal medicine clinic', meta: 'Tue, Mar 18 at 13:00', badge: 'Scheduled', badgeTone: 'neutral' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1
  return age
}

function formatShortDate(dateValue: string | null): string | null {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDaysLeft(dateValue: string | null): number | null {
  if (!dateValue) return null
  const target = new Date(dateValue)
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.max(0, Math.ceil((b - a) / 86400000))
}

function getWarningTone(daysLeft: number | null): DisplayMedication['warningTone'] {
  if (daysLeft === null) return null
  if (daysLeft <= 3) return 'critical'
  if (daysLeft <= 10) return 'warning'
  return null
}

function groupScheduleItems(items: ScheduleItem[]): DisplayMedication[] {
  const groups = new Map<string, ScheduleItem[]>()
  for (const item of items) {
    const current = groups.get(item.prescription_id) ?? []
    current.push(item)
    groups.set(item.prescription_id, current)
  }
  return Array.from(groups.entries()).map(([id, grouped]) => {
    const first = grouped[0]
    const mealTimes = DISPLAY_MEALS.filter((m) => grouped.some((e) => e.meal_time === m))
    return {
      id,
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

// ─── Small screen-local UI ────────────────────────────────────────────────────

function ScreenEmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 26, paddingHorizontal: 24, paddingVertical: 34, alignItems: 'center', shadowColor: '#D7CCBB', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24, elevation: 3 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4E2' }}>
        <Ionicons name={icon} size={28} color="#EFA247" />
      </View>
      <Text style={{ marginTop: 18, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D' }}>{title}</Text>
      <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: '#7E8797', textAlign: 'center' }}>{body}</Text>
    </View>
  )
}

function DetailTabBar({ tabs, activeTab, onTabChange }: { tabs: TabDef[]; activeTab: DetailTab; onTabChange: (tab: DetailTab) => void }) {
  return (
    <View style={{ paddingHorizontal: 8, marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{ flex: 1, minHeight: 56, paddingHorizontal: 4, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: isActive ? '#F1A34A' : 'transparent' }}
            >
              <tab.Icon width={18} height={18} color={isActive ? '#F1A34A' : '#2F2E2D'} />
              <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 14, fontWeight: isActive ? '700' : '500', color: isActive ? '#F1A34A' : '#2F2E2D', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function BottomActions({ onWeeklyFill, onAddMedication }: { onWeeklyFill: () => void; onAddMedication: () => void }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 96, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, backgroundColor: '#F7F2EA' }}>
      <TouchableOpacity onPress={onWeeklyFill} style={{ minHeight: 46, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F6AA4D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 10 }}>
        <Ionicons name="cube-outline" size={16} color="#C96B1A" />
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#C96B1A', marginLeft: 6 }}>Weekly Fill — load cabinet</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onAddMedication} style={{ minHeight: 58, borderRadius: 999, backgroundColor: '#F6AA4D', alignItems: 'center', justifyContent: 'center', shadowColor: '#D59B4A', shadowOpacity: 0.32, shadowOffset: { width: 0, height: 12 }, shadowRadius: 18, elevation: 5 }}>
        <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '500', color: '#2F2E2D' }}>+ Add Medication</Text>
      </TouchableOpacity>
    </View>
  )
}

function PatientBottomNav({ onHome, onWard, onProfile }: { onHome: () => void; onWard: () => void; onProfile: () => void }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE5DB', paddingHorizontal: 32, paddingTop: 12, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={onHome} style={{ alignItems: 'center', minWidth: 76 }}>
          <HomeIcon width={30} height={30} color="#2F2F2F" />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onWard} style={{ alignItems: 'center', minWidth: 76 }}>
          <WardIcon width={30} height={30} color="#2F2F2F" />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#2F2F2F', marginTop: 6 }}>Ward</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfile} style={{ alignItems: 'center', minWidth: 76 }}>
          <ProfileIcon width={30} height={30} color="#2F2F2F" />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 6, width: 128, borderRadius: 999, alignSelf: 'center', marginTop: 16 }} />
    </View>
  )
}

// ─── PatientDetailScreen ──────────────────────────────────────────────────────

export default function PatientDetailScreen() {
  const params    = useLocalSearchParams<{ id?: string | string[]; tab?: string | string[] }>()
  const router    = useRouter()
  const patientId = Array.isArray(params.id)  ? params.id[0]  : params.id
  const tabParam  = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab: DetailTab =
    tabParam === 'history' || tabParam === 'appointments' || tabParam === 'device' || tabParam === 'medications'
      ? tabParam : 'medications'

  const { selectedPatient, loading, fetchPatientDetail } = usePatientStore()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule } = useMedicationStore()

  const [activeTab, setActiveTab]                       = useState<DetailTab>(initialTab)
  const [prescriptions, setPrescriptions]               = useState<LivePrescription[]>([])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)
  const [cabinetSlots, setCabinetSlots]                 = useState<CabinetSlotInfo[]>([])
  const [historyEntries, setHistoryEntries]             = useState<MedicationHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading]             = useState(false)
  const [refreshTick, setRefreshTick]                   = useState(0)

  // ── Load patient + prescriptions + cabinet slots ───────────────────────────
  useEffect(() => {
    if (!patientId) return
    const today = new Date().toISOString().slice(0, 10)

    async function load() {
      if (USE_MOCK) {
        mockSelectPatient(patientId!)
      } else {
        await fetchPatientDetail(patientId!)
      }

      if (user?.ward_id) await fetchSchedule(user.ward_id, today)

      if (!USE_MOCK) {
        setPrescriptionsLoading(true)

        const { data, error } = await supabase
          .from('patient_prescriptions')
          .select('id, patient_id, medicine_id, dose_quantity, meal_times, notes, start_date, end_date, medicines ( id, name, strength, dosage_form )')
          .eq('patient_id', patientId!)
          .eq('is_active', true)
          .order('start_date', { ascending: false })

        if (!error) setPrescriptions((data ?? []) as unknown as LivePrescription[])

        const { data: slots } = await supabase
          .from('cabinet_slots')
          .select('id, cabinet_position, partition, quantity_remaining, initial_quantity, expiry_date, medicines ( name, strength )')
          .eq('patient_id', patientId!)
          .order('cabinet_position', { ascending: true })

        setCabinetSlots(
          ((slots ?? []) as unknown as Array<Omit<CabinetSlotInfo, 'medicine'> & { medicines: { name: string; strength: string | null } | null }>)
            .map((row) => ({ id: row.id, cabinet_position: row.cabinet_position, partition: row.partition, quantity_remaining: row.quantity_remaining, initial_quantity: row.initial_quantity, expiry_date: row.expiry_date, medicine: row.medicines }))
        )
        setPrescriptionsLoading(false)
      }
    }

    void load()
  }, [fetchPatientDetail, fetchSchedule, patientId, user?.ward_id, refreshTick])

  // ── Load history when History tab is opened ────────────────────────────────
  useEffect(() => {
    if (!patientId || activeTab !== 'history') return
    if (USE_MOCK) { setHistoryEntries(MOCK_HISTORY); return }

    let cancelled = false
    setHistoryLoading(true)

    supabase
      .from('medication_logs')
      .select('id, administered_at, meal_time, status, method, refusal_reason, notes, medicines ( name, strength )')
      .eq('patient_id', patientId)
      .order('administered_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setHistoryEntries([]); setHistoryLoading(false); return }
        setHistoryEntries(
          (data ?? []).map((row) => {
            const med = (row as { medicines?: { name?: string; strength?: string | null } | null }).medicines
            return {
              id: row.id as string,
              administered_at: row.administered_at as string,
              meal_time: row.meal_time as MealTime,
              status: row.status as LogStatus,
              method: row.method as LogMethod,
              refusal_reason: (row.refusal_reason as string | null) ?? null,
              notes: (row.notes as string | null) ?? null,
              medicine_name: med?.name ?? 'Medication',
              medicine_strength: med?.strength ?? null,
            }
          })
        )
        setHistoryLoading(false)
      })

    return () => { cancelled = true }
  }, [activeTab, patientId, refreshTick])

  // ── Discontinue prescription ───────────────────────────────────────────────
  const handleDiscontinue = async (prescriptionId: string, medicineName: string) => {
    Alert.alert('Discontinue medication', `Stop ${medicineName}? It will be hidden from the active list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discontinue',
        style: 'destructive',
        onPress: async () => {
          if (USE_MOCK) { Alert.alert('Mock mode', 'Would update patient_prescriptions in live mode.'); return }
          const { error } = await supabase.from('patient_prescriptions').update({ is_active: false }).eq('id', prescriptionId)
          if (error) { Alert.alert('Error', error.message); return }
          setRefreshTick((t) => t + 1)
        },
      },
    ])
  }

  // ── Resolve patient data ───────────────────────────────────────────────────
  const demoPatient     = patientId ? DEMO_PATIENTS[patientId] : null
  const storePatient    = selectedPatient?.id === patientId ? selectedPatient : null
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
        <ScreenEmptyState icon="person-outline" title="Patient not found" body="The detail record could not be loaded. Go back and reopen the patient from the ward list." />
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, minHeight: 48, borderRadius: 999, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFA247' }}>
          <Text style={{ color: '#2F2E2D', fontSize: 15, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ── Derive display values ──────────────────────────────────────────────────
  const patientName         = resolvedPatient?.name        ?? demoPatient?.name        ?? 'Patient'
  const roomNumber          = resolvedPatient?.room_number ?? demoPatient?.room_number ?? 'A-101'
  const age                 = getAge(resolvedPatient?.date_of_birth ?? null) ?? demoPatient?.age ?? null
  const heroMedicationCount = demoPatient?.heroMedicationCount ?? prescriptions.length

  const patientScheduleItems = scheduleGroups.flatMap((g) => g.items).filter((i) => i.patient_id === patientId)

  const liveMedications: DisplayMedication[] = prescriptions.map((rx) => {
    const daysLeft     = getDaysLeft(rx.end_date)
    const expectedName = buildMedicineName(rx.medicines?.name ?? '', rx.medicines?.strength ?? null)
    const slot         = cabinetSlots.find((s) => s.medicine && buildMedicineName(s.medicine.name, s.medicine.strength) === expectedName)
    return {
      id: rx.id,
      medicineId: rx.medicine_id,
      medicineName: buildMedicineName(rx.medicines?.name ?? 'Medication', rx.medicines?.strength ?? null),
      doseQuantity: rx.dose_quantity,
      dosageForm: rx.medicines?.dosage_form ?? 'tablet',
      instructions: rx.notes,
      mealTimes: rx.meal_times,
      daysLeft,
      endDateLabel: formatShortDate(rx.end_date),
      warningTone: getWarningTone(daysLeft),
      quantityRemaining: slot?.quantity_remaining ?? null,
      initialQuantity: slot?.initial_quantity ?? null,
    }
  })

  const groupedScheduleMedications = groupScheduleItems(
    patientScheduleItems.length > 0
      ? patientScheduleItems
      : (MOCK_PRESCRIPTIONS as ScheduleItem[]).filter((i) => i.patient_id === patientId),
  )

  const displayMedications =
    liveMedications.length > 0             ? liveMedications :
    groupedScheduleMedications.length > 0  ? groupedScheduleMedications :
    patientId && DEMO_MEDICATIONS[patientId] ? DEMO_MEDICATIONS[patientId] : []

  const statType       = demoPatient?.statType       ?? displayMedications.length
  const statDosePerDay = demoPatient?.statDosePerDay ?? displayMedications.reduce((t, m) => t + m.doseQuantity * m.mealTimes.length, 0)
  const statEndDate    = demoPatient?.statEndDate    ?? displayMedications.filter((m) => m.endDateLabel || m.warningTone).length

  const HistoryTabIcon: React.FC<{ width?: number; height?: number; color?: string }> = ({ width = 22, height = 22, color = '#2F2E2D' }) =>
    <Ionicons name="time-outline" size={Math.max(width, height)} color={color} />

  const detailTabs: TabDef[] = [
    { key: 'medications',  label: 'Medication',  Icon: MedicineIcon },
    { key: 'history',      label: 'History',     Icon: HistoryTabIcon },
    { key: 'appointments', label: 'Appointments',Icon: AppointmentIcon },
    { key: 'device',       label: 'Device',      Icon: DetailsIcon },
  ]

  const appointments = DEFAULT_APPOINTMENTS.map((item, i) => ({
    ...item,
    id: `${item.id}-${patientId ?? 'patient'}`,
    subtitle: i === 0 ? `${patientName} medication follow-up` : item.subtitle,
  }))

  const liveDeviceItems: DetailPanelItem[] = cabinetSlots.map((slot) => {
    const remaining    = slot.quantity_remaining ?? 0
    const initial      = slot.initial_quantity ?? 0
    const ratio        = initial > 0 ? remaining / initial : null
    const tone: DetailPanelItem['badgeTone'] = ratio === null ? 'neutral' : ratio <= 0.35 ? 'warning' : 'success'
    const badge        = ratio === null ? `${remaining} left` : ratio <= 0.15 ? 'Low' : ratio <= 0.35 ? 'Watch' : 'OK'
    const expiryLabel  = slot.expiry_date ? `Expires ${formatShortDate(slot.expiry_date) ?? slot.expiry_date}` : 'No expiry on file'
    const medicineLabel = slot.medicine ? buildMedicineName(slot.medicine.name, slot.medicine.strength) : 'Unassigned medicine'
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F2EA' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <PatientHeader
        patientName={patientName}
        roomNumber={roomNumber}
        age={age}
        heroMedicationCount={heroMedicationCount}
        onBack={() => router.back()}
        onActions={() => {
          if (!patientId) return
          Alert.alert(patientName, 'Choose an action.', [
            { text: 'รายงานครอบครัว / Daily family update', onPress: () => router.push({ pathname: '/daily-update',    params: { patientId, patientName } }) },
            { text: '🚨 Emergency: Notify Family via LINE',  onPress: () => router.push({ pathname: '/notify-family',   params: { patientId, patientName } }) },
            { text: 'Manage Family Contacts',                onPress: () => router.push({ pathname: '/family-contacts', params: { patientId, patientName } }) },
            { text: 'Hospital Visit Reminder',               onPress: () => router.push({ pathname: '/hospital-visit',  params: { patientId, patientName } }) },
            { text: 'Cancel', style: 'cancel' },
          ])
        }}
      />

      <PatientStatBar statType={statType} statDosePerDay={statDosePerDay} statEndDate={statEndDate} />

      <DetailTabBar tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: activeTab === 'medications' ? 144 : 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Medications tab */}
        {activeTab === 'medications' && displayMedications.length === 0 && (
          <ScreenEmptyState icon="medkit-outline" title="No medication records" body="Add medication to this patient or wait for the daily schedule to sync." />
        )}
        {activeTab === 'medications' && displayMedications.map((med) => (
          <MedicationCard
            key={med.id}
            medication={med}
            patientName={patientName}
            onDiscontinue={handleDiscontinue}
            onRequestRefill={(m) => {
              Alert.alert('Request refill', `Send a refill request for ${m.medicineName} (${patientName})?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Request',
                  onPress: async () => {
                    if (USE_MOCK) { Alert.alert('Mock mode', 'Refill request would be queued in live mode.'); return }
                    const { error } = await supabase.from('prescription_changes').insert({
                      prescription_id: m.id,
                      change_type: 'modified',
                      new_json: { kind: 'refill_request', medicine: m.medicineName, requested_by: user?.id ?? null },
                      changed_by: user?.id ?? '',
                    })
                    if (error) { Alert.alert('Could not file refill request', error.message) }
                    else { Alert.alert('Refill requested', 'A refill request has been logged.') }
                  },
                },
              ])
            }}
          />
        ))}

        {/* Appointments tab */}
        {activeTab === 'appointments' && (
          appointments.length > 0
            ? appointments.map((item) => <DetailInfoCard key={item.id} item={item} />)
            : <ScreenEmptyState icon="calendar-outline" title="No upcoming appointments" body="Hospital visits scheduled for this patient will appear here." />
        )}

        {/* Device tab */}
        {activeTab === 'device' && (
          liveDeviceItems.length > 0
            ? liveDeviceItems.map((item) => <DetailInfoCard key={item.id} item={item} />)
            : <ScreenEmptyState icon="cube-outline" title="No cabinet slots assigned" body="When a PILLo cabinet slot is allocated to this patient, it will show up here." />
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          historyLoading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}><ActivityIndicator color="#EFA247" /></View>
          ) : historyEntries.length === 0 ? (
            <ScreenEmptyState icon="time-outline" title="No medication history yet" body="Past doses for this patient will appear here once medication logs are recorded." />
          ) : (
            <MedicationHistoryList entries={historyEntries} />
          )
        )}
      </ScrollView>

      {activeTab === 'medications' && (
        <BottomActions
          onWeeklyFill={() => {
            if (!patientId) return
            router.push({ pathname: '/dispense-fill/load/[patientId]', params: { patientId, patientName } })
          }}
          onAddMedication={() => {
            if (!patientId) return
            router.push({ pathname: '/add-medication', params: { patientId, patientName } })
          }}
        />
      )}

      <PatientBottomNav
        onHome={() => router.replace('/(tabs)')}
        onWard={() => router.replace('/(tabs)/patients')}
        onProfile={() => router.replace('/(tabs)/settings')}
      />
    </View>
  )
}
