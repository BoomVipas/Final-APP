/**
 * app/dispense-fill/[sessionId]/complete.tsx
 *
 * Stage 3 of the per-patient weekly cabinet-fill workflow (Workflow 18 D5).
 * Mirrors the web's /ward/patients/addToDispenser/schedule/complete page.
 * Reads dispense_items for stats; falls back to "—" when run in mock mode.
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { getDispenseItemsByMeal } from '../../../src/lib/dispenseFill'
import { USE_MOCK } from '../../../src/mocks'
import type { DispenseItemsRow, MealTime } from '../../../src/types/database'

const MEAL_TIMES: MealTime[] = ['morning', 'noon', 'evening', 'bedtime']

export default function CompleteScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ sessionId?: string; patientName?: string; patientId?: string }>()
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
  const patientName = typeof params.patientName === 'string' ? params.patientName : 'Patient'
  const isMockSession = sessionId.startsWith('mock-session-')

  const [loading, setLoading] = useState(!USE_MOCK && !isMockSession)
  const [items, setItems] = useState<DispenseItemsRow[]>([])

  useEffect(() => {
    if (USE_MOCK || isMockSession || !sessionId) {
      setLoading(false)
      return
    }
    let active = true
    Promise.all(MEAL_TIMES.map((m) => getDispenseItemsByMeal(sessionId, m)))
      .then((groups) => {
        if (active) setItems(groups.flat())
      })
      .catch((err) => console.error('Failed to load dispense items:', err))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId, isMockSession])

  const useFallback = USE_MOCK || isMockSession || items.length === 0
  const mealsCount = useFallback ? '—' : String(new Set(items.map((i) => i.meal_time)).size)
  const totalTabs = useFallback ? '—' : String(items.reduce((s, i) => s + i.quantity, 0))
  const types = useFallback ? '—' : String(new Set(items.map((i) => i.medicine_id)).size)

  const handleBack = () => {
    router.replace('/(tabs)')
  }

  return (
    <View className="flex-1 bg-[#F7F2EA]">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <View className="px-5 pt-3 pb-3 flex-row items-center">
          <Pressable onPress={handleBack} className="w-10 h-10 items-center justify-center -ml-2">
            <Ionicons name="close" size={26} color="#313131" />
          </Pressable>
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14] ml-1">
            Weekly Fill — Stage 3
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-[#FFE6CC] items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={72} color="#C96B1A" />
          </View>

          <Text className="text-[24px] leading-[30px] font-bold text-[#C96B1A] text-center mb-2">
            Weekly fill complete!
          </Text>
          <Text className="text-[14px] text-[#7D6E60] text-center mb-10">
            {patientName}
          </Text>

          {loading ? (
            <ActivityIndicator color="#C96B1A" size="small" />
          ) : (
            <View className="flex-row gap-3 mb-10">
              <StatCard value={mealsCount} label="Meals / Day" />
              <StatCard value={totalTabs} label="Total Tabs" />
              <StatCard value={types} label="Med Types" />
            </View>
          )}

          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.85}
            className="flex-row items-center bg-white border border-[#EADBCB] rounded-full px-6 py-3"
          >
            <Ionicons name="arrow-back" size={16} color="#2E241B" />
            <Text className="text-[14px] font-semibold text-[#2E241B] ml-2">Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View className="bg-white border border-[#EADBCB] rounded-2xl px-5 py-4 items-center" style={{ minWidth: 100 }}>
      <Text className="text-[24px] font-bold text-[#2E241B]">{value}</Text>
      <Text className="text-[11px] text-[#7D6E60] mt-1">{label}</Text>
    </View>
  )
}
