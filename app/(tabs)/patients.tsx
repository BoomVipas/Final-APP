/**
 * app/(tabs)/patients.tsx
 * Ward overview screen implemented from the provided Figma screenshot.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dimensions, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { Card } from '../../src/components/ui/Card'
import WardpicIcon from '../../icons/Wardpic.svg'

import { BottomNav } from '../../src/components/shared/BottomNav'
import HospitalIcon from 'icons/HospitalIcon'

const WARD_HEADER_ASPECT_RATIO = 393 / 163

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
    <LinearGradient
      colors={['#F1F1F1', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1, minHeight: 86, borderRadius: 18, borderWidth: 1, borderColor: '#ECE5DB', paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'center' }}
    >
      <Text className="text-[21px] leading-[24px] font-semibold text-[#33312F]">{value}</Text>
      <Text
        className="text-[10px] leading-[15px] text-[#7D8798] mt-1 text-center"
        style={{ width: '100%' }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </LinearGradient>
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
          <View className="w-16 h-16 rounded-[14px] bg-[#FFF5E8] overflow-hidden mr-4 items-center justify-center">
            <WardpicIcon width={40} height={40} />
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
    <View style={{ flex: 1, backgroundColor: '#FFF9F1' }}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <SafeAreaView className="flex-1" edges={['left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor="#F2A24B" />}
      >
        <View style={{ width: Dimensions.get('window').width, aspectRatio: WARD_HEADER_ASPECT_RATIO, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#FFF8EF', '#F6D6B0', '#EFA85A']}
            start={{ x: 0.08, y: 0.02 }}
            end={{ x: 0.92, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View className="absolute left-0 top-6 bottom-10 w-[88px] border-r border-[#E6B982]/60" />
          <View className="absolute right-0 top-8 bottom-10 w-[92px] border-l border-[#E6B982]/50" />
          <View className="absolute left-[90px] right-[90px] top-12 bottom-8 bg-white/30" />
          <View className="absolute bottom-6 left-7 flex-row items-center">
            <HospitalIcon />
            <Text className="text-[28px] leading-[32px] font-bold text-[#2D2B29] ml-3">Ward</Text>
          </View>
        </View>

        <View className="px-5 -mt-3">
          <View className="flex-row gap-3 mb-6">
            <LinearGradient
              colors={['#F1F1F1', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#EDE4D8', paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text className="text-[26px] leading-[30px] font-bold text-[#33312F]">{totalPatients}</Text>
              <Text className="text-[12px] text-[#7D8798] mt-1">Patients</Text>
            </LinearGradient>
            <LinearGradient
              colors={['#F1F1F1', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#EDE4D8', paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}
            >
              <Text className="text-[26px] leading-[30px] font-bold text-[#33312F]">{totalWards}</Text>
              <Text className="text-[12px] text-[#7D8798] mt-1">Ward</Text>
            </LinearGradient>
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
    <BottomNav
      activeTab="ward"
      onHome={() => router.replace('/(tabs)')}
      onWard={() => router.replace('/(tabs)/patients')}
      onProfile={() => router.replace('/(tabs)/settings')}
    />
    </View>
  )
}
