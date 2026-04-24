import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { getDispenseItemsByMeal, updateSessionStatus } from '../../src/lib/db/sessions'
import type { DispenseItemsRow } from '../../src/types/database'

const MEAL_TIMES = ['morning', 'noon', 'evening', 'night'] as const

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View
      className="flex-1 bg-white rounded-[20px] px-3 py-5 items-center"
      style={{
        shadowColor: '#D5C3AF',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
      }}
    >
      <Text className="text-[28px] font-bold text-[#C96B1A]">{value}</Text>
      <Text className="text-[12px] text-[#7D8798] mt-1 text-center">{label}</Text>
    </View>
  )
}

export default function DispenseCompleteScreen() {
  const router = useRouter()
  const {
    patientName  = 'Patient',
    ward         = '',
    wardId       = '',
    sessionId    = '',
    meals:     fallbackMeals     = '0',
    totalTabs: fallbackTotalTabs = '0',
    types:     fallbackTypes     = '0',
  } = useLocalSearchParams<{
    patientName: string
    ward:        string
    wardId:      string
    sessionId:   string
    meals:       string
    totalTabs:   string
    types:       string
  }>()

  const [items,   setItems]   = useState<DispenseItemsRow[]>([])
  const [loading, setLoading] = useState(!!sessionId)

  useEffect(() => {
    if (!sessionId) return
    Promise.all(MEAL_TIMES.map((mt) => getDispenseItemsByMeal(sessionId, mt)))
      .then((results) => {
        const all = results.flat()
        setItems(all)
        return updateSessionStatus(sessionId, 'completed')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sessionId])

  const meals     = items.length > 0 ? String(new Set(items.map((i) => i.meal_time)).size)     : fallbackMeals
  const totalTabs = items.length > 0 ? String(items.reduce((s, i) => s + i.quantity, 0))       : fallbackTotalTabs
  const types     = items.length > 0 ? String(new Set(items.map((i) => i.medicine_id)).size)   : fallbackTypes

  return (
    <SafeAreaView className="flex-1 bg-[#F7F2EA] items-center justify-center px-6" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Success icon */}
      <View className="w-24 h-24 rounded-full bg-[#FFF0E0] items-center justify-center mb-6">
        <Ionicons name="checkmark-circle" size={64} color="#C96B1A" />
      </View>

      {/* Title */}
      <Text className="text-[24px] font-bold text-[#C96B1A] text-center">Weekly fill complete!</Text>
      <Text className="text-[15px] text-[#7D8798] mt-2 text-center">
        {patientName}{ward ? ` · ${ward}` : ''}
      </Text>

      {/* Stats */}
      <View className="flex-row gap-3 mt-8 w-full">
        {loading ? (
          <ActivityIndicator color="#C96B1A" style={{ flex: 1 }} />
        ) : (
          <>
            <StatCard value={meals}     label="Meals / Day" />
            <StatCard value={totalTabs} label="Total Tabs" />
            <StatCard value={types}     label="Types of Med" />
          </>
        )}
      </View>

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.dismiss()}
        activeOpacity={0.85}
        className="mt-10 flex-row items-center gap-2 bg-white rounded-full px-6 py-3.5"
        style={{
          shadowColor: '#D5C3AF',
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <Ionicons name="arrow-back" size={18} color="#4A4A4A" />
        <Text className="text-[15px] font-semibold text-[#4A4A4A]">Back to patients</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
