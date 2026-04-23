import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

import { useAuthStore } from '../src/stores/authStore'
import { useNotificationStore } from '../src/stores/notificationStore'
import { usePatientStore } from '../src/stores/patientStore'

type FilterMode = 'all' | 'stock'

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`rounded-[14px] px-4 py-3 mr-3 ${
        selected ? 'bg-[#F4A74F]' : 'bg-white border border-[#E9DFD2]'
      }`}
    >
      <Text className={`text-[14px] font-medium ${selected ? 'text-[#241F1B]' : 'text-[#524C46]'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function AlertRow({
  title,
  body,
  patient,
  dateLabel,
  icon,
  tone,
  onPress,
}: {
  title: string
  body: string
  patient?: string
  dateLabel: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  tone: 'critical' | 'warning' | 'info'
  onPress: () => void
}) {
  const toneColor =
    tone === 'critical' ? '#F26666' : tone === 'warning' ? '#F0A13C' : '#4F85E5'
  const toneBg =
    tone === 'critical' ? '#FFF2F2' : tone === 'warning' ? '#FFF5E8' : '#EEF4FF'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="bg-white rounded-[22px] px-4 py-4 mb-4 border border-[#EEE4D8]"
      style={{
        shadowColor: '#D7C8B7',
        shadowOpacity: 0.16,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-12 h-12 rounded-[14px] items-center justify-center mr-4"
          style={{ backgroundColor: toneBg }}
        >
          <Ionicons name={icon} size={22} color={toneColor} />
        </View>

        <View className="flex-1 pr-2">
          <View className="flex-row items-start justify-between">
            <Text className="text-[15px] font-semibold text-[#2F2B28] flex-1 pr-2">{title}</Text>
            <Text className="text-[12px] text-[#8B837B]">{dateLabel}</Text>
          </View>
          {patient ? (
            <Text className="text-[13px] text-[#6D665E] mt-1">{patient}</Text>
          ) : null}
          <Text className="text-[13px] leading-[19px] text-[#6D665E] mt-1.5">{body}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function iconForEvent(eventType: string) {
  if (eventType.includes('stock')) return 'warning-outline' as const
  if (eventType.includes('dose')) return 'alarm-outline' as const
  if (eventType.includes('prescription')) return 'medkit-outline' as const
  return 'notifications-outline' as const
}

function formatDateLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Now'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ filter?: string }>()
  const { user } = useAuthStore()
  const { notifications, activeAlerts, unreadCount, fetchNotifications, loading } = useNotificationStore()
  const { patients, fetchPatients } = usePatientStore()
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterMode>(params.filter === 'stock' ? 'stock' : 'all')

  const load = useCallback(async () => {
    if (!user?.id) return
    await fetchNotifications(user.id)
    if (user.ward_id) {
      await fetchPatients(user.ward_id)
    }
  }, [fetchNotifications, fetchPatients, user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setFilter(params.filter === 'stock' ? 'stock' : 'all')
  }, [params.filter])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const patientNameById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient.name])),
    [patients],
  )

  const fallbackRows = [
    {
      id: 'demo-stock',
      title: 'Medication running low',
      body: 'Risperidone 2 mg has 4 tablets remaining.',
      patient: 'Mr. Somchai',
      dateLabel: 'Apr 23',
      tone: 'critical' as const,
      icon: 'warning-outline' as const,
    },
    {
      id: 'demo-dose',
      title: 'Scheduled medication reminder',
      body: 'Next dose needs follow-up within 2 hours.',
      patient: 'Mr. Polo',
      dateLabel: 'Apr 23',
      tone: 'warning' as const,
      icon: 'alarm-outline' as const,
    },
  ]

  const liveRows = notifications.map((notification) => {
    const payload = notification.payload as Record<string, unknown>
    const eventType = String(notification.event_type ?? '')
    const title =
      typeof payload.title_th === 'string' && payload.title_th.trim()
        ? payload.title_th
        : eventType.replace(/_/g, ' ') || 'Notification'
    const body =
      typeof payload.body_th === 'string' && payload.body_th.trim()
        ? payload.body_th
        : 'Open this notification for more detail.'
    const patientId = typeof payload.patient_id === 'string' ? payload.patient_id : null
    const patient = patientId ? patientNameById.get(patientId) : undefined
    const isStock = eventType.includes('stock') || String(payload.alert_type ?? '').includes('stock')

    return {
      id: notification.id,
      title,
      body,
      patient,
      dateLabel: formatDateLabel(notification.sent_at),
      tone: isStock ? ('critical' as const) : ('warning' as const),
      icon: iconForEvent(eventType),
      isStock,
    }
  })

  const rows = (liveRows.length > 0 ? liveRows : fallbackRows).filter((row) =>
    filter === 'stock' ? ('isStock' in row ? row.isStock : true) : true,
  )

  const activeTitle = filter === 'stock' ? 'Low Stock Alerts' : 'Notifications'

  return (
    <SafeAreaView className="flex-1 bg-[#F8F4ED]" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor="#F2A24B" />
        }
      >
        <LinearGradient
          colors={['#FFF6E9', '#FCD9AD', '#F5AF58']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', right: -30, top: 0, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)' }}
          >
            <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
          </TouchableOpacity>

          <Text style={{ marginTop: 18, fontSize: 30, lineHeight: 36, fontWeight: '700', color: '#2F2D2B' }}>
            {activeTitle}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 16, lineHeight: 22, color: '#5C554E' }}>
            {unreadCount > 0 ? `${unreadCount} unread items need attention.` : 'All caught up for now.'}
          </Text>
        </LinearGradient>

        <View className="px-5 pt-5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
            <View className="flex-row">
              <FilterChip label="All Alerts" selected={filter === 'all'} onPress={() => setFilter('all')} />
              <FilterChip label="Low Stock" selected={filter === 'stock'} onPress={() => setFilter('stock')} />
            </View>
          </ScrollView>

          {rows.length === 0 ? (
            <View className="bg-white rounded-[24px] px-6 py-10 items-center border border-[#EEE4D8]">
              <Ionicons name="checkmark-circle-outline" size={34} color="#27B07A" />
              <Text className="text-[18px] font-semibold text-[#2F2B28] mt-4">No notifications here</Text>
              <Text className="text-[14px] text-[#7D756D] text-center mt-2">
                New stock warnings and medication reminders will appear in this feed.
              </Text>
            </View>
          ) : (
            rows.map((row) => (
              <AlertRow
                key={row.id}
                title={row.title}
                body={row.body}
                patient={row.patient}
                dateLabel={row.dateLabel}
                icon={row.icon}
                tone={row.tone}
                onPress={() => Alert.alert(row.title, row.body)}
              />
            ))
          )}

          {activeAlerts.length > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/patients')}
              activeOpacity={0.88}
              className="bg-[#FFF7EC] rounded-[20px] px-5 py-4 mt-2 border border-[#F2DFC5]"
            >
              <Text className="text-[16px] font-semibold text-[#312B27]">Go To Ward Workflow</Text>
              <Text className="text-[13px] text-[#6B635B] mt-1">
                Review patients with pending medication and resolve active alerts from the ward screen.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
