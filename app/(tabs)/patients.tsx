/**
 * app/(tabs)/patients.tsx
 * Ward overview screen — data + state only.
 *
 * UI components live in src/components/ward/:
 *   types.ts      → WardSummaryCard
 *   WardCard.tsx  → ward card with StatBox + low-stock badge
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dimensions, RefreshControl, ScrollView, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Tabs, useRouter } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { supabase } from '../../src/lib/supabase'
import { BottomNav } from '../../src/components/shared/BottomNav'
import HospitalIcon from 'icons/HospitalIcon'

import { WardCard } from '../../src/components/ward/WardCard'
import { type WardSummaryCard } from '../../src/components/ward/types'

const WARD_HEADER_ASPECT_RATIO = 393 / 163

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
  return `Ward ${index >= 0 ? String.fromCharCode(65 + index) : 'A'}`
}

const demoWardCards: WardSummaryCard[] = [
  { id: 'ward-a', title: 'Ward A', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, lowStockCount: 0, fillCompletionLabel: '—', live: false },
  { id: 'ward-b', title: 'Ward B', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, lowStockCount: 0, fillCompletionLabel: '—', live: false },
  { id: 'ward-c', title: 'Ward C', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, lowStockCount: 0, fillCompletionLabel: '—', live: false },
  { id: 'ward-d', title: 'Ward D', subtitle: 'Building 1, Floor 2 - Somying', doseLabel: 'Lunch Dose', patientCount: 16, successCount: 14, pendingCount: 16, lowStockCount: 0, fillCompletionLabel: '—', live: false },
]

export default function PatientsScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { patients, loading, fetchPatients } = usePatientStore()
  const { scheduleGroups, pendingCount, completedCount, fetchSchedule } = useMedicationStore()
  const [refreshing, setRefreshing]               = useState(false)
  const [lowStockCount, setLowStockCount]         = useState(0)
  const [fillCompletionLabel, setFillCompletionLabel] = useState<string>('—')

  const wardId   = user?.ward_id ?? ''
  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!wardId) return
    await Promise.all([fetchPatients(wardId), fetchSchedule(wardId, todayStr)])

    const { data: wardPatients } = await supabase.from('patients').select('id').eq('ward_id', wardId).eq('status', 'active')
    const patientIds = (wardPatients ?? []).map((p) => p.id)

    if (patientIds.length === 0) { setLowStockCount(0); setFillCompletionLabel('—'); return }

    const { data: slots } = await supabase.from('cabinet_slots').select('patient_id, quantity_remaining, initial_quantity').in('patient_id', patientIds)

    const slotsByPatient = new Map<string, { remaining: number; initial: number }[]>()
    for (const slot of slots ?? []) {
      if (!slot.patient_id) continue
      const arr = slotsByPatient.get(slot.patient_id) ?? []
      arr.push({ remaining: slot.quantity_remaining ?? 0, initial: slot.initial_quantity ?? 0 })
      slotsByPatient.set(slot.patient_id, arr)
    }

    let lowStockPatients = 0; let filledPatients = 0
    for (const id of patientIds) {
      const patientSlots = slotsByPatient.get(id) ?? []
      if (patientSlots.length === 0) continue
      if (patientSlots.some(({ remaining, initial }) => initial <= 0 ? remaining <= 2 : remaining / initial <= 0.15)) lowStockPatients++
      if (patientSlots.every(({ remaining }) => remaining > 0)) filledPatients++
    }

    setLowStockCount(lowStockPatients)
    setFillCompletionLabel(`${filledPatients}/${patientIds.length}`)
  }, [fetchPatients, fetchSchedule, todayStr, wardId])

  useEffect(() => { load() }, [load])

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const liveWardCards = useMemo<WardSummaryCard[]>(() => {
    if (!wardId) return []
    return [{ id: wardId, title: formatWardName(wardId), subtitle: 'Building 1, Floor 2 - Somying', doseLabel: getDoseLabel(today), patientCount: patients.length, successCount: completedCount, pendingCount, lowStockCount, fillCompletionLabel, live: true }]
  }, [completedCount, fillCompletionLabel, lowStockCount, patients.length, pendingCount, today, wardId])

  const visualFallback = liveWardCards.length === 0 || (patients.length === 0 && scheduleGroups.length === 0)
  const wardCards      = visualFallback ? demoWardCards : liveWardCards
  const totalPatients  = visualFallback ? 54 : wardCards.reduce((sum, w) => sum + w.patientCount, 0)
  const totalWards     = visualFallback ? 4 : wardCards.length

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
          {/* Header */}
          <View style={{ width: Dimensions.get('window').width, aspectRatio: WARD_HEADER_ASPECT_RATIO, overflow: 'hidden' }}>
            <LinearGradient colors={['#FFF8EF', '#F6D6B0', '#EFA85A']} start={{ x: 0.08, y: 0.02 }} end={{ x: 0.92, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
            <View className="absolute left-0 top-6 bottom-10 w-[88px] border-r border-[#E6B982]/60" />
            <View className="absolute right-0 top-8 bottom-10 w-[92px] border-l border-[#E6B982]/50" />
            <View className="absolute left-[90px] right-[90px] top-12 bottom-8 bg-white/30" />
            <View className="absolute bottom-6 left-7 flex-row items-center">
              <HospitalIcon />
              <Text className="text-[28px] leading-[32px] font-bold text-[#2D2B29] ml-3">Ward</Text>
            </View>
          </View>

          <View className="px-5 -mt-3">
            {/* Summary stats */}
            <View className="flex-row gap-3 mb-6">
              <LinearGradient colors={['#F1F1F1', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#EDE4D8', paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}>
                <Text className="text-[26px] leading-[30px] font-bold text-[#33312F]">{totalPatients}</Text>
                <Text className="text-[12px] text-[#7D8798] mt-1">Patients</Text>
              </LinearGradient>
              <LinearGradient colors={['#F1F1F1', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#EDE4D8', paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}>
                <Text className="text-[26px] leading-[30px] font-bold text-[#33312F]">{totalWards}</Text>
                <Text className="text-[12px] text-[#7D8798] mt-1">Ward</Text>
              </LinearGradient>
            </View>

            {wardCards.map((ward) => (
              <WardCard key={ward.id} ward={ward} onPress={() => router.push(`/ward/${ward.id}`)} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomNav activeTab="ward" onHome={() => router.replace('/(tabs)')} onWard={() => router.replace('/(tabs)/patients')} onProfile={() => router.replace('/(tabs)/settings')} />
    </View>
  )
}
