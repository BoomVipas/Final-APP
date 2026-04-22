/**
 * app/ward/[id].tsx
 * Ward detail screen — two internal tabs: Patients and Dispense.
 * Standalone stack screen (no bottom nav rendered here).
 */

import React, { useState } from 'react'
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

// ---------------------------------------------------------------------------
// Inline mock data
// ---------------------------------------------------------------------------

interface WardPatient {
  id: string
  name: string
  room: string
  age: number
  tablets: number
  status: Array<'urgent' | 'dispensed' | 'low_medication'>
}

interface DispensePatient {
  id: string
  name: string
  room: string
  tablets: number
}

const WARD_PATIENTS: WardPatient[] = [
  { id: 'p1', name: 'Mrs. Somsri Phakrammongkol', room: 'A-101', age: 79, tablets: 9, status: ['urgent'] },
  { id: 'p2', name: 'Mrs. Somchai Rungreang', room: 'A-102', age: 79, tablets: 12, status: ['urgent'] },
  { id: 'p3', name: 'Mr. Mana Jai', room: 'B-203', age: 69, tablets: 5, status: ['dispensed'] },
  { id: 'p4', name: 'Mrs. Dararat Prasartngam', room: 'B-204', age: 80, tablets: 11, status: ['urgent', 'low_medication'] },
  { id: 'p5', name: 'Mrs. Kanya Singkow', room: 'B-205', age: 67, tablets: 12, status: ['urgent'] },
]

const DISPENSE_PATIENTS: DispensePatient[] = [
  { id: 'p2', name: 'Mrs. Somchai Rungreang', room: 'B-203', tablets: 5 },
  { id: 'p5', name: 'Mrs. Kanya Singkow', room: 'B-203', tablets: 5 },
]

const DISPENSED_COUNT = 14

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TabType = 'patients' | 'dispense'
type TimeSlot = 'morning' | 'noon' | 'evening' | 'night'

function StatusBadge({ badge }: { badge: 'urgent' | 'dispensed' | 'low_medication' }) {
  if (badge === 'urgent') {
    return (
      <View className="flex-row items-center bg-red-50 px-2 py-1 rounded-full mr-2 mb-1">
        <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
        <Text className="text-[11px] font-medium text-red-600">Urgent</Text>
      </View>
    )
  }
  if (badge === 'dispensed') {
    return (
      <View className="flex-row items-center bg-green-50 px-2 py-1 rounded-full mr-2 mb-1">
        <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
        <Text className="text-[11px] font-medium text-green-600">Dispensed</Text>
      </View>
    )
  }
  // low_medication
  return (
    <View className="flex-row items-center bg-orange-50 px-2 py-1 rounded-full mr-2 mb-1">
      <Ionicons name="warning-outline" size={11} color="#E8721A" />
      <Text className="text-[11px] font-medium text-[#E8721A] ml-0.5">Low Medication</Text>
    </View>
  )
}

function PatientCard({ patient, onPress }: { patient: WardPatient; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white rounded-2xl shadow-sm mb-3 px-4 py-4 flex-row items-center min-h-[80px]"
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full bg-[#FFF2E1] items-center justify-center mr-3 flex-shrink-0">
        <Ionicons name="person" size={22} color="#E8721A" />
      </View>

      {/* Info */}
      <View className="flex-1 mr-2">
        <Text className="text-[15px] font-bold text-[#343230] mb-1" numberOfLines={1}>
          {patient.name}
        </Text>
        <View className="flex-row items-center mb-1.5">
          <Ionicons name="cube-outline" size={13} color="#8A91A1" />
          <Text className="text-[12px] text-[#7D8798] ml-1">
            Room {patient.room} • Age {patient.age}
          </Text>
        </View>
        <View className="flex-row items-center flex-wrap">
          <View className="flex-row items-center mr-2 mb-1">
            <Ionicons name="medical" size={12} color="#7D8798" />
            <Text className="text-[12px] text-[#7D8798] ml-1">{patient.tablets} tablets</Text>
          </View>
          {patient.status.map((s) => (
            <StatusBadge key={s} badge={s} />
          ))}
        </View>
      </View>

      {/* Menu button */}
      <TouchableOpacity className="min-h-[48px] min-w-[36px] items-center justify-center">
        <Ionicons name="ellipsis-vertical" size={18} color="#4C4845" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

function DispenseCard({
  patient,
  selected,
  onToggle,
}: {
  patient: DispensePatient
  selected: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      className="bg-white rounded-2xl shadow-sm mb-3 px-4 py-4 flex-row items-center min-h-[72px]"
    >
      {/* Radio */}
      <TouchableOpacity
        onPress={onToggle}
        className="w-6 h-6 rounded-full border-2 border-[#C5BEB5] items-center justify-center mr-3 flex-shrink-0 min-h-[48px] min-w-[48px]"
      >
        {selected && <View className="w-3 h-3 rounded-full bg-[#E8721A]" />}
      </TouchableOpacity>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-[#343230] mb-1" numberOfLines={1}>
          {patient.name}
        </Text>
        <View className="flex-row items-center">
          <Ionicons name="cube-outline" size={13} color="#8A91A1" />
          <Text className="text-[12px] text-[#7D8798] ml-1">Room {patient.room}</Text>
        </View>
      </View>

      {/* Tablets */}
      <View className="flex-row items-center">
        <Ionicons name="medical" size={13} color="#E8721A" />
        <Text className="text-[13px] font-semibold text-[#E8721A] ml-1">{patient.tablets} tablets</Text>
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WardDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [activeTab, setActiveTab] = useState<TabType>('patients')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTimeSlot, setActiveTimeSlot] = useState<TimeSlot>('noon')
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set())
  const [dispensedExpanded, setDispensedExpanded] = useState(false)

  // Derive a human-readable ward label from the id
  const wardLabel = (() => {
    if (!id) return 'Ward A'
    const upper = id.toString().toUpperCase()
    if (upper.includes('WARD-')) return `Ward ${upper.replace('WARD-', '')}`
    if (upper.startsWith('WARD')) return `Ward ${upper.slice(4)}`
    return `Ward ${upper}`
  })()

  const filteredPatients = WARD_PATIENTS.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const togglePatient = (patientId: string) => {
    setSelectedPatients((prev) => {
      const next = new Set(prev)
      if (next.has(patientId)) next.delete(patientId)
      else next.add(patientId)
      return next
    })
  }

  const timeSlots: { key: TimeSlot; label: string }[] = [
    { key: 'morning', label: 'Morning' },
    { key: 'noon', label: 'Noon' },
    { key: 'evening', label: 'Evening' },
    { key: 'night', label: 'Night' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E8]" edges={['top', 'left', 'right']}>
      {/* ------------------------------------------------------------------ */}
      {/* HEADER — gradient + back + ward name                                */}
      {/* ------------------------------------------------------------------ */}
      <LinearGradient
        colors={['#F2C98A', '#EEA96A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="px-4 pt-2 pb-14 relative overflow-hidden"
      >
        {/* decorative circles */}
        <View className="absolute right-[-20px] top-0 w-44 h-44 rounded-full bg-[#F9D9B0] opacity-60" />
        <View className="absolute right-8 top-6 w-28 h-28 rounded-full bg-[#FFE6C8] opacity-60" />

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-2 mb-4 min-h-[48px] min-w-[48px] items-center justify-center self-start"
        >
          <Ionicons name="chevron-back" size={26} color="#2D2B29" />
        </TouchableOpacity>

        {/* Ward name */}
        <Text className="text-[32px] font-bold text-[#2D2B29] leading-[36px]">{wardLabel}</Text>
        <View className="flex-row items-center mt-1">
          <Ionicons name="layers-outline" size={14} color="#5C5A57" />
          <Text className="text-[13px] text-[#5C5A57] ml-1.5">Building 1, Floor 2 – Somying</Text>
        </View>
      </LinearGradient>

      {/* ------------------------------------------------------------------ */}
      {/* STATS CARD — overlaps header                                        */}
      {/* ------------------------------------------------------------------ */}
      <View className="mx-4 -mt-6 bg-white rounded-2xl shadow-sm px-4 py-3 flex-row z-10">
        <View className="flex-1 items-center">
          <Text className="text-[20px] font-bold text-[#343230]">16</Text>
          <Text className="text-[11px] text-[#7D8798] mt-0.5">Patients</Text>
        </View>
        <View className="w-px bg-[#ECE4DA] mx-2" />
        <View className="flex-1 items-center">
          <Text className="text-[20px] font-bold text-[#343230]">12</Text>
          <Text className="text-[11px] text-[#7D8798] mt-0.5">Successfully</Text>
        </View>
        <View className="w-px bg-[#ECE4DA] mx-2" />
        <View className="flex-1 items-center">
          <Text className="text-[20px] font-bold text-[#343230]">4</Text>
          <Text className="text-[11px] text-[#7D8798] mt-0.5">Pending</Text>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* TAB SWITCHER                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View className="flex-row mx-4 mt-4 mb-2">
        <TouchableOpacity
          onPress={() => setActiveTab('patients')}
          className={`flex-1 flex-row items-center justify-center py-3 border-b-2 min-h-[48px] ${
            activeTab === 'patients' ? 'border-[#E8721A]' : 'border-transparent'
          }`}
        >
          <Ionicons
            name="person-outline"
            size={17}
            color={activeTab === 'patients' ? '#E8721A' : '#8A91A1'}
          />
          <Text
            className={`ml-1.5 text-[15px] font-semibold ${
              activeTab === 'patients' ? 'text-[#E8721A]' : 'text-[#8A91A1]'
            }`}
          >
            Patients
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('dispense')}
          className={`flex-1 flex-row items-center justify-center py-3 border-b-2 min-h-[48px] ${
            activeTab === 'dispense' ? 'border-[#E8721A]' : 'border-transparent'
          }`}
        >
          <Ionicons
            name="medical-outline"
            size={17}
            color={activeTab === 'dispense' ? '#E8721A' : '#8A91A1'}
          />
          <Text
            className={`ml-1.5 text-[15px] font-semibold ${
              activeTab === 'dispense' ? 'text-[#E8721A]' : 'text-[#8A91A1]'
            }`}
          >
            Dispense
          </Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* CONTENT — scrollable per-tab                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'patients' ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Search row */}
          <View className="flex-row items-center mb-4 mt-2">
            <View className="flex-1 flex-row items-center bg-white rounded-full px-4 py-3 shadow-sm mr-3 min-h-[48px]">
              <Ionicons name="search-outline" size={18} color="#8A91A1" />
              <TextInput
                className="flex-1 ml-2 text-[14px] text-[#343230]"
                placeholder="Search Patient Name"
                placeholderTextColor="#B0B8C5"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm min-h-[48px] min-w-[48px]">
              <Ionicons name="swap-vertical-outline" size={20} color="#4C4845" />
            </TouchableOpacity>
          </View>

          {/* Patient cards */}
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onPress={() => router.push(`/patient/${patient.id}`)}
            />
          ))}

          {/* See More */}
          <TouchableOpacity className="items-center py-4 min-h-[48px]">
            <Text className="text-[14px] text-[#8A91A1] font-medium">+ See More</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Time filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2 mb-4"
              contentContainerStyle={{ paddingVertical: 4 }}
            >
              {timeSlots.map(({ key, label }) => {
                const isActive = activeTimeSlot === key
                const isMorning = key === 'morning'
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActiveTimeSlot(key)}
                    className={`flex-row items-center mr-2 px-4 py-2 rounded-full min-h-[40px] border ${
                      isMorning
                        ? 'border-[#3DB9AB] bg-white'
                        : isActive
                        ? 'border-[#E8721A] bg-[#E8721A]'
                        : 'border-[#D9D4CE] bg-white'
                    }`}
                  >
                    {isMorning && (
                      <Ionicons name="checkmark-circle" size={15} color="#3DB9AB" style={{ marginRight: 4 }} />
                    )}
                    <Text
                      className={`text-[13px] font-medium ${
                        isMorning
                          ? 'text-[#3DB9AB]'
                          : isActive
                          ? 'text-white'
                          : 'text-[#8A91A1]'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Dispense patient list */}
            {DISPENSE_PATIENTS.map((patient) => (
              <DispenseCard
                key={patient.id}
                patient={patient}
                selected={selectedPatients.has(patient.id)}
                onToggle={() => togglePatient(patient.id)}
              />
            ))}
          </ScrollView>

          {/* "N People Paid" expandable section — pinned at bottom */}
          <TouchableOpacity
            onPress={() => setDispensedExpanded((v) => !v)}
            activeOpacity={0.85}
            className="absolute bottom-0 left-0 right-0 mx-4 mb-4 bg-[#E8F7F5] rounded-2xl px-4 py-4 flex-row items-center min-h-[60px] shadow-sm"
          >
            <View className="w-9 h-9 rounded-full bg-[#3DB9AB] items-center justify-center mr-3">
              <Ionicons name="checkmark" size={18} color="white" />
            </View>
            <Text className="flex-1 text-[15px] font-semibold text-[#2D7A72]">
              {DISPENSED_COUNT} People Paid
            </Text>
            <Ionicons
              name={dispensedExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#2D7A72"
            />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}
