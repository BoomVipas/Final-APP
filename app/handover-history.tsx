/**
 * app/handover-history.tsx
 * List past acknowledged shift handovers for the caregiver's ward.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../src/stores/authStore'
import { useHandoverStore } from '../src/stores/handoverStore'
import type { ShiftHandoversRow } from '../src/types/database'
import { USE_MOCK, MOCK_HANDOVER_HISTORY, MOCK_WARD_CAREGIVERS, MOCK_CAREGIVER } from '../src/mocks'

function formatShiftLabel(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameDay = s.toDateString() === e.toDateString()
  const date = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const endTime = e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return sameDay ? `${date} • ${startTime}–${endTime}` : `${date} • ${startTime} → ${endTime}`
}

function shiftPeriod(start: string): string {
  const hour = new Date(start).getHours()
  if (hour >= 6 && hour < 14) return 'เวรเช้า / Morning'
  if (hour >= 14 && hour < 22) return 'เวรบ่าย / Afternoon'
  return 'เวรดึก / Night'
}

function pendingCount(row: ShiftHandoversRow): number {
  const summary = row.summary_json as Record<string, unknown> | undefined
  const pending = summary?.pending_medications as unknown[] | undefined
  return pending?.length ?? 0
}

export default function HandoverHistoryScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { history, loading, fetchHistory, setHistory } = useHandoverStore()
  const [namesById, setNamesById] = useState<Record<string, string>>({})

  useEffect(() => {
    if (USE_MOCK) {
      setHistory(MOCK_HANDOVER_HISTORY as unknown as ShiftHandoversRow[])
      const map: Record<string, string> = {
        [MOCK_CAREGIVER.id]: MOCK_CAREGIVER.name,
      }
      MOCK_WARD_CAREGIVERS.forEach((c) => { map[c.id] = c.name })
      setNamesById(map)
      return
    }
    if (!user?.ward_id) return
    fetchHistory(user.ward_id)
  }, [user, fetchHistory, setHistory])

  useEffect(() => {
    if (USE_MOCK) return
    if (history.length === 0) return
    const ids = new Set<string>()
    history.forEach((h) => {
      if (h.caregiver_id) ids.add(h.caregiver_id)
      if (h.acknowledged_by_id) ids.add(h.acknowledged_by_id)
    })
    if (ids.size === 0) return
    const load = async () => {
      try {
        const { supabase } = await import('../src/lib/supabase')
        const { data } = await supabase
          .from('users')
          .select('id, name')
          .in('id', [...ids])
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((u: { id: string; name: string }) => { map[u.id] = u.name })
        setNamesById(map)
      } catch (err) {
        console.warn('Could not load caregiver names', err)
      }
    }
    load()
  }, [history])

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => new Date(b.shift_end).getTime() - new Date(a.shift_end).getTime())
  }, [history])

  return (
    <SafeAreaView className="flex-1 bg-[#F6EFE6]">
      <View className="flex-row items-center justify-between px-4 pt-3 pb-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#2E241B" />
        </Pressable>
        <Text className="text-[16px] font-bold text-[#2E241B]">Handover History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C96B1A" />
          <Text className="text-sm text-[#7D6E60] mt-3">กำลังโหลด...</Text>
        </View>
      ) : sortedHistory.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-3">📋</Text>
          <Text className="text-base font-bold text-[#2E241B] text-center">
            ยังไม่มีประวัติการรับเวร
          </Text>
          <Text className="text-sm text-[#7D6E60] text-center mt-2">
            เมื่อมีการรับเวรในวอร์ดนี้ จะแสดงในรายการนี้
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {sortedHistory.map((row) => {
            const fromName = namesById[row.caregiver_id] ?? 'ไม่ทราบ'
            const toName = row.acknowledged_by_id ? namesById[row.acknowledged_by_id] ?? 'ไม่ทราบ' : '—'
            const pending = pendingCount(row)
            return (
              <View
                key={row.id}
                className="bg-[#FFF9F2] border border-[#EADBCB] rounded-[20px] px-4 py-4 mb-3"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="bg-[#FFE6CC] rounded-full px-3 py-1">
                    <Text className="text-[11px] font-semibold text-[#8E4B14]">
                      {shiftPeriod(row.shift_start)}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} color="#2F6B55" />
                    <Text className="text-[11px] text-[#2F6B55] ml-1 font-medium">
                      Acknowledged
                    </Text>
                  </View>
                </View>

                <Text className="text-[14px] font-semibold text-[#2E241B]">
                  {formatShiftLabel(row.shift_start, row.shift_end)}
                </Text>

                <View className="flex-row items-center mt-2">
                  <Ionicons name="person-outline" size={13} color="#7D6E60" />
                  <Text className="text-[12px] text-[#7D6E60] ml-1.5">
                    {fromName} → {toName}
                  </Text>
                </View>

                {pending > 0 ? (
                  <View className="flex-row items-center mt-1.5">
                    <Ionicons name="alert-circle-outline" size={13} color="#A3322A" />
                    <Text className="text-[12px] text-[#A3322A] ml-1.5">
                      {pending} ยาค้าง / pending dose{pending > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : null}

                {row.shift_notes ? (
                  <View className="mt-3 bg-white border border-[#EADBCB] rounded-[12px] px-3 py-2">
                    <Text className="text-[11px] text-[#9B8E80] uppercase tracking-wider mb-0.5">
                      Notes
                    </Text>
                    <Text className="text-[13px] text-[#2E241B]" numberOfLines={3}>
                      {row.shift_notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
