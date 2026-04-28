/**
 * app/notify-family.tsx
 * Free-form LINE message composer for a patient family.
 * Workflow 12 / Workflow 15 A4.
 */

import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { USE_MOCK } from '../src/mocks'
import { sendCaregiverMessage } from '../src/lib/lineNotifier'
import type { FamilyContactsRow } from '../src/types/database'

const MAX_LEN = 500

const QUICK_TEMPLATES: Array<{ id: string; emoji: string; label_th: string; label_en: string; body: string }> = [
  {
    id: 'out_of_meds',
    emoji: '💊',
    label_th: 'ยาหมด',
    label_en: 'Out of medicine',
    body: 'ยาของผู้ป่วยเหลือน้อยมาก ต้องการให้ครอบครัวมาเติมยาด่วนค่ะ',
  },
  {
    id: 'condition_worse',
    emoji: '🤒',
    label_th: 'อาการแย่ลง',
    label_en: 'Condition worsened',
    body: 'อาการของผู้ป่วยแย่ลง กรุณาติดต่อกลับโดยด่วนค่ะ',
  },
  {
    id: 'fall',
    emoji: '🚑',
    label_th: 'ลื่นล้ม',
    label_en: 'Patient fell',
    body: 'ผู้ป่วยลื่นล้ม ขณะนี้ปลอดภัยแล้ว แต่อยากให้ครอบครัวรับทราบค่ะ',
  },
  {
    id: 'urgent_visit',
    emoji: '🏥',
    label_th: 'มาเยี่ยมด่วน',
    label_en: 'Please come urgently',
    body: 'รบกวนครอบครัวมาเยี่ยมผู้ป่วยที่สถานพยาบาลโดยด่วนค่ะ',
  },
]

const MOCK_CONTACTS: FamilyContactsRow[] = [
  {
    id: 'mock-fc-1',
    patient_id: 'mock-patient',
    name: 'Khun Pranee',
    relationship: 'Daughter',
    line_user_id: 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    phone: '081-234-5678',
    notification_preferences: {},
    link_token: 'mock-token-1',
    linked_at: null,
    created_at: new Date(0).toISOString(),
  } as FamilyContactsRow,
  {
    id: 'mock-fc-2',
    patient_id: 'mock-patient',
    name: 'Khun Anan',
    relationship: 'Son',
    line_user_id: null,
    phone: '089-555-0001',
    notification_preferences: {},
    link_token: 'mock-token-2',
    linked_at: null,
    created_at: new Date(0).toISOString(),
  } as FamilyContactsRow,
]

export default function NotifyFamilyScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId
  const patientName =
    (Array.isArray(params.patientName) ? params.patientName[0] : params.patientName) ?? 'Patient'
  const { user } = useAuthStore()

  const [contacts, setContacts] = useState<FamilyContactsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    if (USE_MOCK) {
      setContacts(MOCK_CONTACTS.map((row) => ({ ...row, patient_id: patientId })))
      setLoading(false)
      return
    }

    supabase
      .from('family_contacts')
      .select(
        'id, patient_id, name, relationship, line_user_id, phone, notification_preferences, link_token, linked_at, created_at',
      )
      .eq('patient_id', patientId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setContacts((data ?? []) as FamilyContactsRow[])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [patientId])

  const reachable = contacts.filter((c) => !!c.line_user_id)
  const unreachable = contacts.filter((c) => !c.line_user_id)
  const trimmed = text.trim()
  const canSend = !sending && !!patientId && trimmed.length > 0 && reachable.length > 0

  const onSend = async () => {
    if (!canSend || !patientId) return
    if (USE_MOCK) {
      Alert.alert(
        'Mock mode',
        `Would send to ${reachable.length} LINE contact${reachable.length === 1 ? '' : 's'}.`,
      )
      setText('')
      return
    }
    setSending(true)
    try {
      const result = await sendCaregiverMessage({
        patientId,
        patientName,
        text: trimmed,
        senderName: user?.name ?? 'PILLo Caregiver',
      })
      const summary = `Sent ${result.sent}  ·  Failed ${result.failed}  ·  Skipped ${result.skipped}`
      Alert.alert('Message sent', summary, [
        {
          text: 'OK',
          onPress: () => {
            setText('')
            router.back()
          },
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed'
      Alert.alert('Could not send', message)
    } finally {
      setSending(false)
    }
  }

  if (!patientId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 16, color: '#2F2D2B', textAlign: 'center' }}>
          Open this screen from a patient profile.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 18,
            minHeight: 48,
            paddingHorizontal: 22,
            borderRadius: 999,
            backgroundColor: '#F2A24B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#2E2C2A', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE' }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#FFE4D6', '#F8A483', '#EF6E50']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.65)',
            }}
          >
            <Ionicons name="chevron-back" size={26} color="#2F2D2B" />
          </Pressable>
        </View>
        <Text style={{ marginTop: 18, fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#2F2D2B' }}>
          🚨 แจ้งเหตุฉุกเฉิน
        </Text>
        <Text style={{ marginTop: 4, fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#3A1F11' }}>
          Emergency family alert · {patientName}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E4B14', letterSpacing: 1 }}>RECIPIENTS</Text>
          {loading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color="#ED9A41" />
            </View>
          ) : reachable.length === 0 ? (
            <View
              style={{
                marginTop: 10,
                padding: 16,
                borderRadius: 16,
                backgroundColor: '#FFF8EC',
                borderWidth: 1,
                borderColor: '#F0DEC1',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#8E4B14' }}>
                No LINE contacts on file
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: '#5C554E' }}>
                Add a LINE user ID to a family contact before sending. Phone-only contacts cannot
                receive LINE messages.
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/family-contacts',
                    params: { patientId, patientName },
                  })
                }
                style={{
                  marginTop: 12,
                  alignSelf: 'flex-start',
                  minHeight: 44,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  backgroundColor: '#F2A24B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2E2C2A' }}>
                  Manage contacts
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 10, gap: 8 }}>
              {reachable.map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#EFE4D5',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#FFF3E5',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color="#8E4B14" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#2F2D2B' }}>{c.name}</Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: '#7B746C' }}>
                      {c.relationship ?? 'Family contact'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {unreachable.length > 0 ? (
            <Text style={{ marginTop: 8, fontSize: 11, color: '#857E76', fontStyle: 'italic' }}>
              {unreachable.length} contact{unreachable.length === 1 ? '' : 's'} without LINE will be
              skipped (phone-only).
            </Text>
          ) : null}

          <Text style={{ marginTop: 22, fontSize: 12, fontWeight: '700', color: '#A3322A', letterSpacing: 1 }}>
            QUICK TEMPLATE
          </Text>
          <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => setText(tpl.body.slice(0, MAX_LEN))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: text === tpl.body ? '#FCD7CF' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: text === tpl.body ? '#EF6E50' : '#EFE4D5',
                  minHeight: 44,
                }}
              >
                <Text style={{ fontSize: 16, marginRight: 6 }}>{tpl.emoji}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2F2D2B' }}>
                  {tpl.label_th}
                </Text>
                <Text style={{ fontSize: 11, color: '#7B746C', marginLeft: 6 }}>
                  / {tpl.label_en}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ marginTop: 22, fontSize: 12, fontWeight: '700', color: '#A3322A', letterSpacing: 1 }}>
            MESSAGE
          </Text>
          <View
            style={{
              marginTop: 8,
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#EFE4D5',
              padding: 14,
            }}
          >
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_LEN))}
              placeholder="พิมพ์ข้อความหรือเลือกเทมเพลตด้านบน / Type a message or pick a template above..."
              placeholderTextColor="#B0A89E"
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 140,
                fontSize: 15,
                lineHeight: 22,
                color: '#2F2D2B',
              }}
            />
          </View>
          <Text style={{ marginTop: 6, alignSelf: 'flex-end', fontSize: 11, color: '#857E76' }}>
            {text.length}/{MAX_LEN}
          </Text>

          <Text style={{ marginTop: 18, fontSize: 12, lineHeight: 18, color: '#857E76' }}>
            Sent as {user?.name ?? 'PILLo Caregiver'}. Emergency alerts go through immediately —
            keep messages short and actionable.
          </Text>

          <TouchableOpacity
            onPress={onSend}
            disabled={!canSend}
            style={{
              marginTop: 24,
              minHeight: 64,
              borderRadius: 999,
              backgroundColor: canSend ? '#EF5D5D' : '#E8DBC8',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              shadowColor: '#EF5D5D',
              shadowOpacity: canSend ? 0.32 : 0,
              shadowOffset: { width: 0, height: 10 },
              shadowRadius: 16,
              elevation: canSend ? 6 : 0,
            }}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="warning" size={22} color="#FFFFFF" />
                <Text style={{ marginLeft: 10, fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
                  ส่งแจ้งเหตุด่วน · Send Emergency Alert
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
