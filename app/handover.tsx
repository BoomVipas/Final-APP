/**
 * app/handover.tsx
 * Shift handover acknowledgment screen — required before dismissal.
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../src/stores/authStore'
import { HandoverSummary } from '../src/components/shared/HandoverSummary'
import { Button } from '../src/components/ui/Button'
import type { ShiftHandoversRow } from '../src/types/database'
import { USE_MOCK, MOCK_HANDOVER } from '../src/mocks'

export default function HandoverScreen() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [handover, setHandover] = useState<ShiftHandoversRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    // Disable hardware back until acknowledged
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!acknowledged) {
        Alert.alert('ไม่สามารถออกได้', 'กรุณากด "รับทราบ" ก่อนออกจากหน้านี้')
        return true
      }
      return false
    })
    return () => backHandler.remove()
  }, [acknowledged])

  useEffect(() => {
    if (USE_MOCK) {
      // Inject mock handover — unacknowledged so the screen shows fully
      setHandover(MOCK_HANDOVER as unknown as ShiftHandoversRow)
      setLoading(false)
      return
    }
    const loadHandover = async () => {
      if (!user) return
      setLoading(true)
      try {
        const { supabase } = await import('../src/lib/supabase')
        const wardId = user?.ward_id ?? ''
        if (!wardId) { setLoading(false); return }
        const { data, error } = await supabase
          .from('shift_handovers')
          .select('*')
          .eq('ward_id', wardId)
          .is('acknowledged_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        setHandover(data ?? null)
      } catch (err) {
        console.error('Failed to load handover:', err)
      } finally {
        setLoading(false)
      }
    }
    loadHandover()
  }, [user])

  const handleAcknowledge = async () => {
    if (!handover || !user) return
    setAcknowledging(true)
    if (USE_MOCK) {
      // Simulate a short delay then mark acknowledged locally
      await new Promise((r) => setTimeout(r, 600))
      setAcknowledged(true)
      setAcknowledging(false)
      return
    }
    try {
      const { supabase } = await import('../src/lib/supabase')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { error } = await sb
        .from('shift_handovers')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', (handover as any).id)
      if (error) throw error
      setAcknowledged(true)
    } catch (err) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกการรับทราบได้')
    } finally {
      setAcknowledging(false)
    }
  }

  const handleDismiss = () => {
    if (!acknowledged && handover) {
      Alert.alert('ไม่สามารถออกได้', 'กรุณากด "รับทราบ" ก่อนออกจากหน้านี้')
      return
    }
    router.replace('/(tabs)')
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F6EFE6] items-center justify-center">
        <ActivityIndicator size="large" color="#C96B1A" />
        <Text className="text-sm text-[#7D6E60] mt-3">กำลังโหลดสรุปกะ...</Text>
      </SafeAreaView>
    )
  }

  if (!handover) {
    return (
      <SafeAreaView className="flex-1 bg-[#F6EFE6] px-6">
        <View className="flex-1 items-center justify-center">
          <View className="bg-[#FFF9F2] border border-[#EADBCB] rounded-[30px] px-6 py-10 w-full items-center">
            <Text className="text-5xl mb-4">✅</Text>
            <Text className="text-xl font-bold text-[#2E241B] text-center mb-2">
              ไม่มีกะที่รอรับทราบ
            </Text>
            <Text className="text-sm text-[#7D6E60] text-center mb-8">
              ยังไม่มีสรุปกะที่ต้องรับทราบในขณะนี้
            </Text>
            <Button title="กลับหน้าหลัก" onPress={() => router.replace('/(tabs)')} variant="primary" />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F6EFE6]">
      <View className="px-4 pt-3 pb-2">
        <View className="bg-[#FFF3E5] border border-[#E8CFB0] rounded-[28px] px-4 py-4">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">
            Shift Handover
          </Text>
          <Text className="text-[26px] leading-[32px] font-bold text-[#2E241B] mt-2">
            สรุปกะที่ผ่านมา
          </Text>
          <Text className="text-sm text-[#6F6254] mt-2">
          {!acknowledged
            ? 'กรุณาอ่านและกด "รับทราบ" ด้านล่างเพื่อดำเนินการต่อ'
            : '✅ รับทราบแล้ว — สามารถออกจากหน้านี้ได้'}
          </Text>
        </View>
      </View>

      <View className="flex-1 px-4 pt-2">
        <HandoverSummary handover={handover} />
      </View>

      <View className="px-4 pb-6 pt-3 bg-[#F6EFE6]">
        {!acknowledged ? (
          <Button
            title="รับทราบ"
            onPress={handleAcknowledge}
            variant="primary"
            loading={acknowledging}
            disabled={acknowledging}
          />
        ) : (
          <Button
            title="ไปหน้าหลัก"
            onPress={handleDismiss}
            variant="primary"
          />
        )}
      </View>
    </SafeAreaView>
  )
}
