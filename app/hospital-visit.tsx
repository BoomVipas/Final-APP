/**
 * app/hospital-visit.tsx
 * Workflow 15 A5 — caregiver schedules a hospital visit reminder for a patient.
 * On save: writes a `notification_logs` row with `event_type:'hospital_visit_reminder'`
 * (LINE family fan-out is queued separately via the line-notifier edge function — see HUMAN ACTIONS).
 */

import React, { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { useAuthStore } from '../src/stores/authStore'
import { supabase } from '../src/lib/supabase'
import { USE_MOCK } from '../src/mocks'
import { scheduleRefillReminder } from '../src/lib/notifications'

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/

function defaultVisitDate(): string {
  const d = new Date()
  do {
    d.setDate(d.getDate() + 1)
  } while (d.getDay() === 0 || d.getDay() === 6)
  return d.toISOString().slice(0, 10)
}

export default function HospitalVisitScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId
  const patientName = (Array.isArray(params.patientName) ? params.patientName[0] : params.patientName) ?? 'Patient'
  const { user } = useAuthStore()

  const [visitDate, setVisitDate] = useState(defaultVisitDate())
  const [visitTime, setVisitTime] = useState('09:30')
  const [notes, setNotes] = useState('')
  const [notifyFamily, setNotifyFamily] = useState(true)
  const [scheduleLocalReminder, setScheduleLocalReminder] = useState(true)
  const [saving, setSaving] = useState(false)

  const minutesUntilVisit = useMemo(() => {
    if (!DATE_PATTERN.test(visitDate) || !TIME_PATTERN.test(visitTime)) return null
    const target = new Date(`${visitDate}T${visitTime}:00`)
    if (Number.isNaN(target.getTime())) return null
    return Math.round((target.getTime() - Date.now()) / (60 * 1000))
  }, [visitDate, visitTime])

  const validate = (): string | null => {
    if (!patientId) return 'Open this screen from a patient profile.'
    if (!DATE_PATTERN.test(visitDate)) return 'Visit date must be YYYY-MM-DD (e.g. 2026-05-12).'
    if (!TIME_PATTERN.test(visitTime)) return 'Visit time must be HH:MM (e.g. 09:30).'
    if (minutesUntilVisit !== null && minutesUntilVisit < 0) {
      return 'Visit must be in the future.'
    }
    return null
  }

  const save = async () => {
    const errMsg = validate()
    if (errMsg) {
      Alert.alert('Cannot save', errMsg)
      return
    }
    setSaving(true)

    try {
      if (USE_MOCK) {
        Alert.alert('Mock mode', 'Hospital visit reminder would be queued in live mode.')
        router.back()
        return
      }

      const visitAt = new Date(`${visitDate}T${visitTime}:00`).toISOString()

      const { error } = await supabase.from('notification_logs').insert({
        recipient_type: notifyFamily ? 'family' : 'caregiver',
        recipient_id: notifyFamily ? (patientId ?? '') : (user?.id ?? ''),
        channel: notifyFamily ? 'line' : 'push',
        event_type: 'hospital_visit_reminder',
        payload: {
          patient_id: patientId,
          patient_name: patientName,
          visit_at: visitAt,
          notes: notes.trim() || null,
          notify_family: notifyFamily,
          title_th: 'นัดหมายโรงพยาบาล',
          body_th: `${patientName} มีนัดหมายโรงพยาบาล ${visitDate} เวลา ${visitTime} น.${notes.trim() ? `\n${notes.trim()}` : ''}`,
        },
        status: 'sent',
      })

      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }

      if (scheduleLocalReminder && minutesUntilVisit !== null) {
        const daysFromNow = Math.max(minutesUntilVisit / (60 * 24), 1 / (24 * 60))
        const reminderDays = Math.max(daysFromNow - 1, 1 / (24 * 60))
        await scheduleRefillReminder({
          medicineName: `Hospital visit — ${patientName}`,
          daysFromNow: reminderDays,
          patientName,
        })
      }

      Alert.alert(
        'Reminder saved',
        notifyFamily
          ? 'Family will be notified once the LINE channel is wired up.'
          : 'Reminder logged for caregivers.',
      )
      router.back()
    } finally {
      setSaving(false)
    }
  }

  if (!patientId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 16, color: '#2F2D2B', textAlign: 'center' }}>
          Open this screen from a patient profile to schedule a hospital visit.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 18, minHeight: 48, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#F2A24B', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#2E2C2A', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE' }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <LinearGradient
          colors={['#FFF7ED', '#FBD7A8', '#F3A449']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.55)' }}
          >
            <Ionicons name="chevron-back" size={26} color="#2F2D2B" />
          </Pressable>
          <Text style={{ marginTop: 18, fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#2F2D2B' }}>
            Hospital visit reminder
          </Text>
          <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: '#5C554E' }}>
            For {patientName}
          </Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
          <FieldLabel>Visit date *</FieldLabel>
          <FieldInput
            value={visitDate}
            onChangeText={setVisitDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />

          <FieldLabel>Visit time *</FieldLabel>
          <FieldInput
            value={visitTime}
            onChangeText={setVisitTime}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
          />

          <FieldLabel>Notes</FieldLabel>
          <FieldInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Outpatient cardiology, fasting required..."
            multiline
            style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
            maxLength={500}
          />

          <View
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#EFE4D5',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#2F2D2B' }}>Notify family via LINE</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: '#7B746C' }}>
                  Sends through `line-notifier` once the channel access token is configured.
                </Text>
              </View>
              <Switch
                value={notifyFamily}
                onValueChange={setNotifyFamily}
                trackColor={{ true: '#F2A24B', false: '#DDD3C5' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={{ height: 1, backgroundColor: '#F1ECE5', marginVertical: 14 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#2F2D2B' }}>Schedule local reminder</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: '#7B746C' }}>
                  Fires a local push the day before the visit.
                </Text>
              </View>
              <Switch
                value={scheduleLocalReminder}
                onValueChange={setScheduleLocalReminder}
                trackColor={{ true: '#F2A24B', false: '#DDD3C5' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={{
              marginTop: 22,
              minHeight: 56,
              borderRadius: 999,
              backgroundColor: '#F2A24B',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#2E2C2A' }}>
              {saving ? 'Saving...' : 'Save reminder'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: '600', color: '#5E5145' }}>
      {children}
    </Text>
  )
}

function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#B0A89E"
      {...props}
      style={[{
        minHeight: 48,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EADBCB',
        backgroundColor: '#FFFFFF',
        fontSize: 14,
        color: '#2E241B',
      }, props.style]}
    />
  )
}
