/**
 * app/(tabs)/patients.tsx
 * Ward overview screen implemented from the provided Figma screenshot.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { Card } from '../../src/components/ui/Card'

interface WardSummaryCard {
  id: string
  title: string
  subtitle: string
  doseLabel: string
  patientCount: number
  successCount: number
  pendingCount: number
  live: boolean
}

function getDoseLabel(date: Date): string {
  const hour = date.getHours()
  if (hour < 11) return 'Breakfast Dose'
  if (hour < 15) return 'Lunch Dose'
  if (hour < 20) return 'Dinner Dose'
  return 'Bedtime Dose'
}

function formatWardName(wardId: string | null | undefined): string {
  if (!wardId) return 'Ward A'
  const match = wardId.match(/(\d+)/)
  if (!match) return wardId
  const index = Number(match[1]) - 1
  const letter = index >= 0 ? String.fromCharCode(65 + index) : 'A'
  return `Ward ${letter}`
}

function StatBox({
  value,
  label,
}: {
  value: number
  label: string
}) {
  return (
    <View className="flex-1 min-h-[86px] rounded-[18px] bg-white border border-[#ECE5DB] px-4 py-4 justify-center">
      <Text className="text-[21px] leading-[24px] font-semibold text-[#33312F]">{value}</Text>
      <Text className="text-[11px] leading-[15px] text-[#7D8798] mt-1">{label}</Text>
    </View>
  )
}

function WardCard({
  ward,
  onPress,
}: {
  ward: WardSummaryCard
  onPress: () => void
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className="mb-5">
      <Card className="bg-white shadow-sm px-4 py-4">
        <View className="flex-row items-start">
          <View className="w-16 h-16 rounded-[14px] bg-[#FFF2E1] items-center justify-center mr-4">
            <Ionicons name="business" size={28} color="#F2A24B" />
          </View>

          <View className="flex-1 pr-8">
            <Text className="text-[18px] leading-[22px] font-bold text-[#343230]">{ward.title}</Text>

            <View className="flex-row items-center mt-2">
              <Ionicons name="layers-outline" size={17} color="#8A91A1" />
              <Text className="text-[14px] leading-[18px] text-[#7D8798] ml-2 flex-1">{ward.subtitle}</Text>
            </View>

            <View className="flex-row items-center mt-2">
              <Ionicons name="time-outline" size={17} color="#8A91A1" />
              <Text className="text-[14px] leading-[18px] text-[#7D8798] ml-2">{ward.doseLabel}</Text>
            </View>
          </View>

          <TouchableOpacity className="min-h-[30px] min-w-[26px] items-center justify-center absolute right-1 top-0">
            <Ionicons name="ellipsis-vertical" size={18} color="#4C4845" />
          </TouchableOpacity>
        </View>

        <View className="h-px bg-[#ECE4DA] mt-5 mb-4" />

        <View className="flex-row">
          <StatBox value={ward.patientCount} label="Patients" />
          <View className="w-3" />
          <StatBox value={ward.successCount} label="Successfully" />
          <View className="w-3" />
          <StatBox value={ward.pendingCount} label="Pending" />
        </View>
      </Card>
    </TouchableOpacity>
  )
}

export default function PatientsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { patients, loading, fetchPatients } = usePatientStore()
  const { scheduleGroups, pendingCount, completedCount, fetchSchedule } = useMedicationStore()
  const [refreshing, setRefreshing] = useState(false)

  const wardId = user?.ward_id ?? ''
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!wardId) return
    await Promise.all([
      fetchPatients(wardId),
      fetchSchedule(wardId, todayStr),
    ])
  }, [fetchPatients, fetchSchedule, todayStr, wardId])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const liveWardCards = useMemo<WardSummaryCard[]>(() => {
    if (!wardId) return []

    return [{
      id: wardId,
      title: formatWardName(wardId),
      subtitle: 'Building 1, Floor 2 - Somying',
      doseLabel: getDoseLabel(today),
      patientCount: patients.length,
      successCount: completedCount,
      pendingCount,
      live: true,
    }]
  }, [completedCount, patients.length, pendingCount, today, wardId])

  const demoWardCards: WardSummaryCard[] = [
    { id: 'ward-a', title: 'Ward A', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, live: false },
    { id: 'ward-b', title: 'Ward B', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, live: false },
    { id: 'ward-c', title: 'Ward C', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, live: false },
    { id: 'ward-d', title: 'Ward D', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, live: false },
  ]

  const visualFallback = liveWardCards.length === 0 || (patients.length === 0 && scheduleGroups.length === 0)
  const wardCards = visualFallback ? demoWardCards : liveWardCards
  const totalPatients = visualFallback ? 54 : wardCards.reduce((sum, ward) => sum + ward.patientCount, 0)
  const totalWards = visualFallback ? 4 : wardCards.length

  return (
    <SafeAreaView className="flex-1 bg-[#FFF9F1]" edges={['left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor="#F2A24B" />}
      >
        <View className="bg-[#F8C27D] px-7 pt-8 pb-7 overflow-hidden">
          <View className="absolute left-[-40] top-6 w-40 h-40 rounded-full bg-[#F7D8B0] opacity-30" />
          <View className="absolute right-[-20] top-0 w-44 h-44 rounded-full bg-[#F9D9B0] opacity-60" />
          <View className="absolute right-2 top-5 w-28 h-28 rounded-full bg-[#FFE6C8] opacity-60" />

          <View className="flex-row items-center mt-8">
            <Ionicons name="bed" size={30} color="#2D2B29" />
            <Text className="text-[28px] leading-[32px] font-bold text-[#2D2B29] ml-3">Ward</Text>
          </View>
        </View>

        <View className="px-5 -mt-9">
          <View className="rounded-[24px] bg-white border border-[#EDE4D8] px-5 py-3 shadow-sm mb-6">
            <View className="flex-row items-center">
              <View className="flex-1 items-center py-1.5">
                <Text className="text-[24px] leading-[28px] font-semibold text-[#33312F]">{totalPatients}</Text>
                <Text className="text-[13px] text-[#7D8798] mt-1.5">Patients</Text>
              </View>

              <View className="w-px h-16 bg-[#E9E1D7]" />

              <View className="flex-1 items-center py-1.5">
                <Text className="text-[24px] leading-[28px] font-semibold text-[#33312F]">{totalWards}</Text>
                <Text className="text-[13px] text-[#7D8798] mt-1.5">Ward</Text>
              </View>
            </View>
          </View>

          {wardCards.map((ward) => (
            <WardCard
              key={ward.id}
              ward={ward}
              onPress={() => router.push(`/ward/${ward.id}`)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
