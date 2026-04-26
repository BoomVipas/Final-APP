/**
 * app/handover.tsx
 * Shift handover acknowledgment screen — required before dismissal.
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../src/stores/authStore'
import { HandoverSummary } from '../src/components/shared/HandoverSummary'
import { Button } from '../src/components/ui/Button'
import type { ShiftHandoversRow, UsersRow } from '../src/types/database'
import { USE_MOCK, MOCK_HANDOVER, MOCK_WARD_CAREGIVERS } from '../src/mocks'

interface NotePreset {
  id: string
  icon: string
  label_th: string
  label_en: string
  text: string
}

const NOTE_PRESETS: NotePreset[] = [
  { id: 'all-clear',  icon: '✅', label_th: 'ทุกอย่างเรียบร้อย', label_en: 'All clear',          text: '✅ ทุกอย่างเรียบร้อย / All clear' },
  { id: 'refused',    icon: '🚫', label_th: 'ปฏิเสธยา',         label_en: 'Refused dose',       text: '🚫 ผู้ป่วยปฏิเสธยา — ' },
  { id: 'prn',        icon: '💊', label_th: 'ให้ยา PRN',        label_en: 'PRN given',          text: '💊 ให้ยา PRN — ' },
  { id: 'side',       icon: '⚠️', label_th: 'อาการข้างเคียง',   label_en: 'Side effects',       text: '⚠️ พบอาการข้างเคียง — ' },
  { id: 'vitals',     icon: '🩺', label_th: 'สัญญาณชีพผิดปกติ', label_en: 'Vitals abnormal',    text: '🩺 สัญญาณชีพผิดปกติ — ' },
  { id: 'family',     icon: '📞', label_th: 'ญาติติดต่อ',        label_en: 'Family contact',     text: '📞 ญาติติดต่อ — ' },
  { id: 'doctor',     icon: '👨‍⚕️', label_th: 'ต้องตามแพทย์',     label_en: 'Doctor follow-up',   text: '👨‍⚕️ ต้องตามแพทย์ — ' },
  { id: 'sleep',      icon: '😴', label_th: 'นอนไม่หลับ',         label_en: 'Sleep poor',         text: '😴 ผู้ป่วยนอนไม่หลับ — ' },
  { id: 'appetite',   icon: '🍽️', label_th: 'กินอาหารน้อย',       label_en: 'Poor appetite',      text: '🍽️ ผู้ป่วยกินอาหารน้อย — ' },
  { id: 'fall-risk',  icon: '🚷', label_th: 'เสี่ยงล้ม',           label_en: 'Fall risk',          text: '🚷 ผู้ป่วยเสี่ยงล้ม — ระวังเป็นพิเศษ' },
]

export default function HandoverScreen() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [handover, setHandover] = useState<ShiftHandoversRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  const [wardCaregivers, setWardCaregivers] = useState<UsersRow[]>([])
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null)
  const [shiftNotes, setShiftNotes] = useState('')
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set())
  const [deferredKeys, setDeferredKeys] = useState<Set<string>>(new Set())

  const toggleDefer = (key: string) => {
    setDeferredKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePreset = (preset: NotePreset) => {
    const isSelected = selectedPresetIds.has(preset.id)
    if (isSelected) {
      setShiftNotes((current) => {
        const lines = current.split('\n')
        const idx = lines.findIndex((line) => line.startsWith(preset.text))
        if (idx < 0) return current
        lines.splice(idx, 1)
        return lines.join('\n').replace(/^\n+/, '')
      })
      setSelectedPresetIds((prev) => {
        const next = new Set(prev)
        next.delete(preset.id)
        return next
      })
    } else {
      setShiftNotes((current) => {
        if (!current.trim()) return preset.text
        return current.trimEnd() + '\n' + preset.text
      })
      setSelectedPresetIds((prev) => {
        const next = new Set(prev)
        next.add(preset.id)
        return next
      })
    }
  }

  useEffect(() => {
    if (USE_MOCK) {
      setHandover(MOCK_HANDOVER as unknown as ShiftHandoversRow)
      setWardCaregivers(MOCK_WARD_CAREGIVERS)
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

        const { data: caregivers } = await supabase
          .from('users')
          .select('id, email, name, phone, role, ward_id, created_at')
          .eq('ward_id', wardId)
          .neq('id', user.id)
        setWardCaregivers((caregivers ?? []) as UsersRow[])
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
    if (!selectedCaregiverId) {
      Alert.alert('กรุณาเลือกผู้รับเวร', 'โปรดเลือกผู้ดูแลที่จะรับเวรต่อก่อนกด "รับทราบ"')
      return
    }
    setAcknowledging(true)
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 600))
      setAcknowledged(true)
      setAcknowledging(false)
      return
    }
    try {
      const { supabase } = await import('../src/lib/supabase')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const updatedSummary = {
        ...(handover.summary_json as Record<string, unknown>),
        deferred_item_keys: [...deferredKeys],
      }
      const { error } = await sb
        .from('shift_handovers')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by_id: selectedCaregiverId,
          shift_notes: shiftNotes.trim() || null,
          summary_json: updatedSummary,
        })
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
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
                ? 'กรุณาอ่านและกรอกข้อมูลด้านล่างก่อนกด "รับทราบ"'
                : '✅ รับทราบแล้ว — สามารถออกจากหน้านี้ได้'}
            </Text>
          </View>
        </View>

        <View className="px-4 pt-2">
          <HandoverSummary
            handover={handover}
            deferredKeys={!acknowledged ? deferredKeys : undefined}
            onToggleDefer={!acknowledged ? toggleDefer : undefined}
          />
        </View>

        {!acknowledged ? (
          <>
            <View className="px-4 pt-4">
              <View className="bg-[#FFF9F2] border border-[#EADBCB] rounded-[20px] px-4 py-4">
                <Text className="text-[15px] font-bold text-[#2E241B]">
                  ส่งต่อให้ / Handing over to
                </Text>
                <Text className="text-[12px] text-[#7D6E60] mt-1 mb-3">
                  เลือกผู้ดูแลที่จะรับเวรต่อ
                </Text>

                {wardCaregivers.length === 0 ? (
                  <Text className="text-[13px] text-[#9B8E80] italic">
                    ไม่พบผู้ดูแลคนอื่นในวอร์ดนี้
                  </Text>
                ) : (
                  <View>
                    {wardCaregivers.map((c) => {
                      const selected = selectedCaregiverId === c.id
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => setSelectedCaregiverId(c.id)}
                          activeOpacity={0.85}
                          className={`flex-row items-center justify-between rounded-[14px] px-3 py-3 mb-2 border ${
                            selected
                              ? 'bg-[#FFF1DD] border-[#C96B1A]'
                              : 'bg-white border-[#EADBCB]'
                          }`}
                        >
                          <View className="flex-row items-center flex-1 pr-2">
                            <View className="w-10 h-10 rounded-full bg-[#FFE6CC] items-center justify-center mr-3">
                              <Text className="text-[14px] font-bold text-[#8E4B14]">
                                {c.name.charAt(0)}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text className="text-[14px] font-semibold text-[#2E241B]" numberOfLines={1}>
                                {c.name}
                              </Text>
                              <Text className="text-[12px] text-[#7D6E60]" numberOfLines={1}>
                                {c.role === 'nurse' ? 'พยาบาล' : c.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ดูแล'}
                                {c.phone ? ` • ${c.phone}` : ''}
                              </Text>
                            </View>
                          </View>
                          <View
                            className={`w-6 h-6 rounded-full items-center justify-center border ${
                              selected ? 'bg-[#C96B1A] border-[#C96B1A]' : 'bg-white border-[#D6C5B2]'
                            }`}
                          >
                            {selected ? (
                              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            </View>

            <View className="px-4 pt-3">
              <View className="bg-[#FFF9F2] border border-[#EADBCB] rounded-[20px] px-4 py-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[15px] font-bold text-[#2E241B]">
                    บันทึกการส่งเวร / Shift notes
                  </Text>
                  {shiftNotes.length > 0 || selectedPresetIds.size > 0 ? (
                    <TouchableOpacity
                      onPress={() => {
                        setShiftNotes('')
                        setSelectedPresetIds(new Set())
                      }}
                      className="flex-row items-center px-2 py-1"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={14} color="#9B8E80" />
                      <Text className="text-[11px] text-[#7D6E60] ml-1 font-medium">ล้าง / Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text className="text-[12px] text-[#7D6E60] mt-1 mb-3">
                  แตะเพื่อเพิ่มเหตุการณ์ที่พบบ่อย หรือพิมพ์เพิ่มได้ / Tap a chip or type freely
                </Text>

                <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                  {NOTE_PRESETS.map((preset) => {
                    const selected = selectedPresetIds.has(preset.id)
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        onPress={() => togglePreset(preset)}
                        activeOpacity={0.8}
                        className={`flex-row items-center rounded-full px-3 py-2 border ${
                          selected
                            ? 'bg-[#C96B1A] border-[#C96B1A]'
                            : 'bg-[#FFF1DD] border-[#EADBCB]'
                        }`}
                        style={{ minHeight: 32 }}
                        accessibilityLabel={`Toggle preset ${preset.label_en}`}
                        accessibilityState={{ selected }}
                      >
                        <Text className="text-[13px] mr-1.5">{preset.icon}</Text>
                        <Text className={`text-[12px] font-medium ${selected ? 'text-white' : 'text-[#8E4B14]'}`}>
                          {preset.label_th}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <TextInput
                  value={shiftNotes}
                  onChangeText={setShiftNotes}
                  multiline
                  numberOfLines={5}
                  placeholder="เช่น คุณสมชายปฏิเสธยา 12:00 — ติดตามมื้อเย็น"
                  placeholderTextColor="#A89B8C"
                  textAlignVertical="top"
                  style={{
                    minHeight: 110,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#EADBCB',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: '#2E241B',
                  }}
                />
                <Text className="text-[11px] text-[#9B8E80] mt-2 text-right">
                  {shiftNotes.length} ตัวอักษร
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View className="px-4 pb-6 pt-3 bg-[#F6EFE6] border-t border-[#EADBCB]">
        {!acknowledged ? (
          <Button
            title="รับทราบ"
            onPress={handleAcknowledge}
            variant="primary"
            loading={acknowledging}
            disabled={acknowledging || !selectedCaregiverId}
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
