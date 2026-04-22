/**
 * app/patient/[id].tsx
 * Patient detail screen — redesigned to match new Figma layout.
 * Header: orange gradient with patient info + avatar
 * Stats card overlapping header bottom
 * Tab bar: Medication / Appointments / Device
 * Medication list cards with stock warnings
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { usePatientStore } from '../../src/stores/patientStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleItem } from '../../src/stores/medicationStore'
import { USE_MOCK, MOCK_PRESCRIPTIONS, mockSelectPatient } from '../../src/mocks'

// ─── Types ────────────────────────────────────────────────────────────────────

type DetailTab = 'medications' | 'appointments' | 'device'

interface DisplayMed {
  prescription_id: string
  patient_id: string
  medicine_name: string
  dose_quantity: number
  notes: string | null
  meal_times_active: string[]
  days_left?: number
  end_date?: string
  low_stock?: boolean
  low_stock_severity?: 'critical' | 'warning'
}

// ─── Mock display data ────────────────────────────────────────────────────────

function getMockMedsDisplay(id: string): DisplayMed[] {
  return [
    {
      prescription_id: 'rx-demo-1',
      patient_id: id,
      medicine_name: 'Amlodipine 5 mg',
      dose_quantity: 1,
      notes: 'Before bedtime',
      meal_times_active: ['morning'],
      days_left: 3,
      end_date: 'Mar 14',
      low_stock: true,
      low_stock_severity: 'critical',
    },
    {
      prescription_id: 'rx-demo-2',
      patient_id: id,
      medicine_name: 'Metoprolol 25 mg',
      dose_quantity: 1,
      notes: 'Before bedtime',
      meal_times_active: ['morning'],
      days_left: 25,
      low_stock: false,
    },
    {
      prescription_id: 'rx-demo-3',
      patient_id: id,
      medicine_name: 'Amlodipine 5 mg',
      dose_quantity: 1,
      notes: 'Before bedtime',
      meal_times_active: ['morning'],
      days_left: 10,
      end_date: 'Mar 14',
      low_stock: true,
      low_stock_severity: 'warning',
    },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const month = today.getMonth() - dob.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function scheduleItemToDisplayMed(item: ScheduleItem): DisplayMed {
  return {
    prescription_id: item.prescription_id,
    patient_id: item.patient_id,
    medicine_name: item.medicine_name + (item.medicine_strength ? ` ${item.medicine_strength}` : ''),
    dose_quantity: item.dose_quantity,
    notes: item.notes,
    meal_times_active: [item.meal_time],
    low_stock: false,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MEAL_TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  noon: 'Noon',
  evening: 'Evening',
  bedtime: 'Night',
}

function MealTimeChip({ period, active }: { period: string; active: boolean }) {
  const label = MEAL_TIME_LABELS[period] ?? period
  return (
    <View
      className={`px-3 py-1 rounded-full border mr-2 mb-1 ${
        active ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white'
      }`}
    >
      <Text className={`text-xs font-medium ${active ? 'text-teal-600' : 'text-gray-400'}`}>
        {label}
      </Text>
    </View>
  )
}

function MedCard({ med }: { med: DisplayMed }) {
  const allPeriods = ['morning', 'noon', 'evening', 'bedtime']

  return (
    <View className="bg-white rounded-2xl mx-4 mb-3 p-4 shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 }}>
      {/* Top row: name + menu */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-base font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
          {med.medicine_name}
        </Text>
        <TouchableOpacity className="min-h-[36px] min-w-[36px] items-center justify-center">
          <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Sub row: dose + notes */}
      <View className="flex-row items-center mb-3">
        <Ionicons name="medkit-outline" size={13} color="#9CA3AF" />
        <Text className="text-sm text-gray-400 ml-1">
          {med.dose_quantity} tablet{med.dose_quantity !== 1 ? 's' : ''}
          {med.notes ? `  •  ${med.notes}` : ''}
        </Text>
      </View>

      {/* Meal time chips */}
      <View className="flex-row flex-wrap mb-2">
        {allPeriods.map((period) => (
          <MealTimeChip
            key={period}
            period={period}
            active={med.meal_times_active.includes(period)}
          />
        ))}
      </View>

      {/* Stock warning */}
      {med.low_stock && med.low_stock_severity === 'critical' && (
        <View className="mt-2 pt-3 border-t border-gray-100">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-start flex-1 mr-2">
              <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginTop: 1 }} />
              <View className="ml-2 flex-1">
                <Text className="text-sm font-bold text-red-500">
                  {med.days_left} days left{med.end_date ? `  •  Ends on ${med.end_date}` : ''}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Medication will run out before the next refill
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="border border-gray-300 rounded-full px-3 py-1.5 min-h-[36px] items-center justify-center"
            >
              <Text className="text-xs font-medium text-gray-600">Set Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {med.low_stock && med.low_stock_severity === 'warning' && (
        <View className="mt-2 pt-3 border-t border-gray-100">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-start flex-1 mr-2">
              <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginTop: 1 }} />
              <View className="ml-2 flex-1">
                <Text className="text-sm font-bold text-amber-500">
                  {med.days_left} days left{med.end_date ? `  •  Ends on ${med.end_date}` : ''}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Medication will run out before the next refill
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="border border-gray-300 rounded-full px-3 py-1.5 min-h-[36px] items-center justify-center"
            >
              <Text className="text-xs font-medium text-gray-600">Set Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!med.low_stock && typeof med.days_left === 'number' && (
        <View className="mt-2 pt-3 border-t border-gray-100 flex-row items-center">
          <Ionicons name="time-outline" size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-400 ml-1">{med.days_left} days left</Text>
        </View>
      )}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { selectedPatient, loading, fetchPatientDetail } = usePatientStore()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule } = useMedicationStore()

  const [activeTab, setActiveTab] = useState<DetailTab>('medications')

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!id) return
    if (USE_MOCK) {
      mockSelectPatient(id)
      return
    }
    await fetchPatientDetail(id)
    const wardId = user?.ward_id ?? ''
    if (wardId) await fetchSchedule(wardId, today)
  }, [fetchPatientDetail, fetchSchedule, id, today, user])

  useEffect(() => {
    load()
  }, [load])

  const patient = selectedPatient?.id === id ? selectedPatient : null
  const allItems = scheduleGroups.flatMap((group) => group.items)
  const patientMeds = allItems.filter((item) => item.patient_id === id)
  const mockRxForPatient = USE_MOCK
    ? (MOCK_PRESCRIPTIONS as ScheduleItem[]).filter((item) => item.patient_id === id)
    : []

  // Loading state
  if (loading && !patient) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0E8] items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E8721A" />
      </SafeAreaView>
    )
  }

  // Not found state
  if (!patient) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F0E8] items-center justify-center px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="bg-white rounded-2xl items-center py-10 w-full shadow-sm">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-base font-bold text-gray-800 text-center">Patient not found</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 min-h-[48px] px-6 items-center justify-center"
          >
            <Text className="text-[#E8721A] font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const age = patient.date_of_birth ? getAge(patient.date_of_birth) : null

  // Build displayMeds
  let displayMeds: DisplayMed[]
  if (USE_MOCK) {
    const fallback = getMockMedsDisplay(id ?? '')
    const fromStore = mockRxForPatient.map(scheduleItemToDisplayMed)
    displayMeds = fromStore.length > 0 ? fromStore : fallback
  } else {
    displayMeds = patientMeds.map(scheduleItemToDisplayMed)
  }

  // Stats
  const statType = USE_MOCK ? 16 : displayMeds.length
  const statDose = USE_MOCK ? 12 : displayMeds.reduce((sum, m) => sum + m.dose_quantity, 0)
  const statEndDate = USE_MOCK ? 4 : displayMeds.filter((m) => m.end_date).length

  const TABS: { key: DetailTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'medications', label: 'Medication', icon: 'medical-outline' },
    { key: 'appointments', label: 'Appointments', icon: 'people-outline' },
    { key: 'device', label: 'Device', icon: 'hardware-chip-outline' },
  ]

  return (
    <View className="flex-1 bg-[#F5F0E8]">
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Orange gradient header ── */}
      <LinearGradient
        colors={['#F2C060', '#E8A050']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 48 }}
      >
        <SafeAreaView edges={['top']}>
          {/* Decorative bubbles */}
          <View
            className="absolute top-0 right-8 w-32 h-32 rounded-full opacity-20"
            style={{ backgroundColor: '#FFF3CC' }}
            pointerEvents="none"
          />
          <View
            className="absolute top-12 right-0 w-20 h-20 rounded-full opacity-15"
            style={{ backgroundColor: '#FFE0A0' }}
            pointerEvents="none"
          />

          {/* Top bar */}
          <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="min-h-[48px] min-w-[48px] items-center justify-center"
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-base font-semibold text-white">Patient Detail</Text>
            {/* Spacer to balance back button */}
            <View className="w-[48px]" />
          </View>

          {/* Patient info + avatar */}
          <View className="flex-row items-center px-5 pb-2">
            {/* Left: name + room + tablet count */}
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-white mb-1" numberOfLines={1}>
                {patient.name}
              </Text>
              <View className="flex-row items-center mb-2">
                <Ionicons name="grid-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text className="text-sm text-white/85 ml-1">
                  Room {patient.room_number ?? 'N/A'}
                  {age !== null ? `  •  Age ${age}` : ''}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="medkit-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text className="text-sm text-white/85 ml-1">
                  {statDose} tablets
                </Text>
              </View>
            </View>

            {/* Avatar */}
            <View
              className="w-20 h-20 rounded-full bg-white items-center justify-center"
              style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 4 }}
            >
              <Ionicons name="person" size={40} color="#E8A050" />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ── Stats card overlapping header ── */}
      <View
        className="bg-white rounded-2xl mx-4 shadow-sm"
        style={{ marginTop: -36, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 3 }}
      >
        <View className="flex-row py-4">
          {/* Type */}
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-gray-900">{statType}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Type</Text>
          </View>
          {/* Divider */}
          <View className="w-px bg-gray-100 my-2" />
          {/* Dose/Day */}
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-gray-900">{statDose}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Dose/Day</Text>
          </View>
          {/* Divider */}
          <View className="w-px bg-gray-100 my-2" />
          {/* End Date */}
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-gray-900">{statEndDate}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">End Date</Text>
          </View>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View className="flex-row mx-4 mt-4 mb-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 flex-row items-center justify-center min-h-[48px] pb-2"
              style={isActive ? { borderBottomWidth: 2, borderBottomColor: '#E8721A' } : { borderBottomWidth: 2, borderBottomColor: 'transparent' }}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? '#E8721A' : '#9CA3AF'}
                style={{ marginRight: 4 }}
              />
              <Text
                className={`text-sm font-semibold ${isActive ? 'text-[#E8721A]' : 'text-gray-400'}`}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'medications' ? (
          displayMeds.length === 0 ? (
            <View className="mx-4 bg-white rounded-2xl items-center py-12 shadow-sm">
              <Text className="text-4xl mb-3">💊</Text>
              <Text className="text-base font-bold text-gray-800">No medications today</Text>
              <Text className="text-sm text-gray-400 mt-1">No scheduled medications found</Text>
            </View>
          ) : (
            displayMeds.map((med) => (
              <MedCard key={med.prescription_id} med={med} />
            ))
          )
        ) : (
          <View className="mx-4 bg-white rounded-2xl items-center py-12 shadow-sm">
            <Text className="text-4xl mb-4">🗂️</Text>
            <Text className="text-base font-bold text-gray-800">
              {activeTab === 'appointments' ? 'Appointments' : 'Device Info'}
            </Text>
            <Text className="text-sm text-gray-400 mt-1">Coming soon</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Add Medication button ── */}
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-[#F5F0E8]">
        <TouchableOpacity
          className="bg-[#E8721A] rounded-full min-h-[52px] items-center justify-center w-full"
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold text-base">+ Add Medication</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
