/**
 * app/(tabs)/index.tsx
 * Home screen implemented from the provided Figma screenshot.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import DoubleCheckIcon from '../../icons/DoubleCheckIcon'
import ScanMedicationIcon from '../../icons/ScanMedicationIcon'
import LowStockIcon from '../../icons/LowStockIcon'
import OrderIcon from '../../icons/OrderIcon'
import PillIcon from '../../icons/PillIcon'
import HourglassIcon from '../../icons/HourglassIcon'
import AlarmClockIcon from '../../icons/AlarmClockIcon'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { useNotificationStore } from '../../src/stores/notificationStore'
import { useHandoverStore } from '../../src/stores/handoverStore'
import { USE_MOCK, MOCK_HANDOVER } from '../../src/mocks'
import type { ShiftHandoversRow } from '../../src/types/database'
import { Card } from '../../src/components/ui/Card'
import { PatientAvatar } from '../../src/components/shared/PatientAvatar'
import { supabase } from '../../src/lib/supabase'
import type { WardsRow } from '../../src/types/database'
import { BottomNav } from '../../src/components/shared/BottomNav'
import SystemIcon from 'icons/SystemIcon'
import { colors, typo } from '@/theme/typo'

interface AlertCardData {
  id: string
  patientName: string
  title: string
  medication: string
  detail: string
  footnote: string
  cta: string
  ctaTone: 'danger' | 'warning'
}

interface DispensePatientCard {
  id: string
  name: string
  room: string
  age: string
  wardId: string
  ward: string
  tablets: string
  statusLabel: string
  statusTone: 'urgent' | 'pending' | 'done'
  tags: string[]
  note?: string
  moreCount?: number
}

interface WardFilterOption {
  id: string
  label: string
  patientCount: number
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function getDoseLabel(date: Date): string {
  const hour = date.getHours()
  if (hour < 11) return 'Morning dose'
  if (hour < 15) return 'Noon dose'
  if (hour < 20) return 'Evening dose'
  return 'Bedtime dose'
}

function getAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '-'
  const dob = new Date(dateOfBirth)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const month = now.getMonth() - dob.getMonth()
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age--
  return String(age)
}

function getFirstName(name: string | null | undefined): string {
  if (!name?.trim()) return 'User'
  return name.trim().split(/\s+/)[0]
}

function formatWardLabel(wardId: string | null | undefined): string {
  if (!wardId) return 'Ward'
  const normalized = wardId.trim().toLowerCase()
  if (normalized === 'ward-a' || normalized === 'a') return 'Ward A'
  if (normalized === 'ward-b' || normalized === 'b') return 'Ward B'

  const digitMatch = normalized.match(/(\d+)/)
  if (digitMatch) {
    const index = Number(digitMatch[1])
    if (index >= 1 && index <= 26) {
      return `Ward ${String.fromCharCode(64 + index)}`
    }
  }

  if (normalized.startsWith('ward')) return wardId.replace(/-/g, ' ')
  return `Ward ${wardId}`
}

function formatWardOptionLabel(wardId: string, ward?: Pick<WardsRow, 'name' | 'floor'> | null): string {
  const name = ward?.name?.trim() || formatWardLabel(wardId)
  const floor = ward?.floor?.trim()
  if (!floor) return name
  return name.toLowerCase().includes(floor.toLowerCase()) ? name : `${name} (${floor})`
}

function ActionItem({
  SvgIcon,
  label,
  onPress,
}: {
  SvgIcon: React.FC<{ width?: number; height?: number }>
  label: string
  onPress: () => void
}) {
  const lines = label.split('\n')

  return (
    <TouchableOpacity onPress={onPress} className="flex-1 items-center px-1">
      <View className="w-[62px] h-[62px] rounded-[20px] bg-[#FFF5E8] items-center justify-center mb-2.5">
        <SvgIcon width={42} height={42} />
      </View>
      {lines.map((line, i) => (
        <Text key={i} className="text-[11px] leading-[15px] font-semibold text-[#2E2C2A] text-center">
          {line}
        </Text>
      ))}
    </TouchableOpacity>
  )
}

interface StatCardGradient {
  colors: [string, string]
  start: { x: number; y: number }
  end: { x: number; y: number }
}

function StatCard({
  label,
  value,
  SvgIcon,
  iconBg,
  iconColor,
  gradient,
  onPress,
}: {
  label: string
  value: number
  SvgIcon: React.FC<{ width?: number; height?: number; color?: string }>
  iconBg?: string
  iconColor?: string
  gradient: StatCardGradient
  onPress: () => void
}) {
  const cardStyle = {
    flex: 1,
    borderRadius: 14,
  }

  return (
    <LinearGradient
      colors={gradient.colors}
      start={gradient.start}
      end={gradient.end}
      style={cardStyle}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={{ flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 }}
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-[15px] leading-[20px] font-medium text-[#3B3836] flex-1 pr-2">{label}</Text>
          <View
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: iconBg ?? '#EBEBEB' }}
          >
            <SvgIcon width={22} height={22} color={iconColor ?? '#505050'} />
          </View>
        </View>
        <View className="flex-row items-end justify-between mt-4">
          <Text className="text-[30px] font-bold text-[#1F1D1B]">{value}</Text>
          <Ionicons name="chevron-forward" size={18} color="#5A5654" />
        </View>
      </TouchableOpacity>
    </LinearGradient>
  )
}

function AlertCard({
  alert,
  onPress,
  onMorePress,
}: {
  alert: AlertCardData
  onPress: () => void
  onMorePress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white border border-[#F0E6D8] rounded-[16px] px-4 pt-4 pb-4 mb-3"
      style={{ shadowColor: '#B09070', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}
    >
      <View className="flex-row items-start">
        <View className="w-[52px] h-[52px] rounded-[14px] bg-[#FFF3E4] items-center justify-center mr-3">
          <Text className="text-[26px]">💊</Text>
        </View>

        <View className="flex-1 pr-2">
          <Text className="text-[14px] font-bold text-[#282420]">{alert.patientName}</Text>
          <Text className="text-[12.5px] text-[#5A5450] mt-0.5">{alert.title}</Text>

          <View className="flex-row items-center mt-2">
            <Ionicons name="medkit-outline" size={12} color="#9B9590" />
            <Text className="text-[12px] text-[#837E7A] ml-1.5" numberOfLines={1}>{alert.medication}</Text>
          </View>

          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={12} color="#9B9590" />
            <Text className="text-[12px] text-[#837E7A] ml-1.5">{alert.detail}</Text>
          </View>

          <View className={`self-start mt-3 rounded-full px-3 py-1.5 ${
            alert.ctaTone === 'danger' ? 'bg-[#FFEEED]' : 'bg-[#FFF2E4]'
          }`}>
            <Text className={`text-[11px] font-medium ${
              alert.ctaTone === 'danger' ? 'text-[#FF5A52]' : 'text-[#E08830]'
            }`}>
              🔔 {alert.cta}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onMorePress} className="min-h-[32px] min-w-[24px] items-center justify-center">
          <Ionicons name="ellipsis-vertical" size={16} color="#4A4744" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function StatusChip({
  label,
  tone,
}: {
  label: string
  tone: DispensePatientCard['statusTone']
}) {
  const toneClass =
    tone === 'urgent'
      ? 'bg-[#FFF1F3] text-[#FF6B6B]'
      : tone === 'pending'
        ? 'bg-[#FFF5E6] text-[#F0A13C]'
        : 'bg-[#E9FBF3] text-[#24B57A]'

  return (
    <View className={`rounded-full px-2.5 py-1 ${toneClass}`}>
      <Text className="text-[11px] font-medium">{label}</Text>
    </View>
  )
}

function cleanMedicationLabel(label: string) {
  return label.replace(/^•\s*/, '').trim()
}

function MedicationTag({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      className={`rounded-[10px] border px-2 py-1.5 mr-1.5 ${
      accent ? 'border-[#FF8E84] bg-[#FFF9F9]' : 'border-[#ECE7DF] bg-white'
    }`}
      style={{ maxWidth: 126, flexShrink: 1 }}
    >
      <Text
        numberOfLines={1}
        className={`text-[10px] leading-[14px] ${accent ? 'text-[#FF6A63]' : 'text-[#454240]'}`}
      >
        • {cleanMedicationLabel(label)}
      </Text>
    </View>
  )
}

function PatientCard({
  patient,
  onPress,
  onMorePress,
}: {
  patient: DispensePatientCard
  onPress: () => void
  onMorePress: () => void
}) {
  const visibleTags = patient.tags.slice(0, 3)
  const hiddenTagCount = Math.max(patient.tags.length - visibleTags.length, 0) + (patient.moreCount ?? 0)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white border border-[#EDE4D8] rounded-[18px] px-4 py-4 mb-3"
      style={{ shadowColor: '#A07840', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <View className="flex-row items-start">
        <PatientAvatar name={patient.name} size={48} className="mr-3" />

        <View className="flex-1 pr-2">
          <View className="flex-row items-start justify-between">
            <Text className="text-[14px] font-bold text-[#282420] flex-1 pr-2">{patient.name}</Text>
            <TouchableOpacity onPress={onMorePress} className="min-h-[32px] min-w-[24px] items-center justify-center">
              <Ionicons name="ellipsis-vertical" size={16} color="#4A4744" />
            </TouchableOpacity>
          </View>

          <Text className="text-[12px] text-[#7B7880] mt-0.5">
            {patient.room} • Age {patient.age} • {patient.ward}
          </Text>

          <View className="flex-row items-center mt-1.5">
            <Ionicons name="medkit-outline" size={13} color="#7B7880" />
            <Text className="text-[12px] text-[#7B7880] ml-1.5 mr-2">{patient.tablets}</Text>
            <StatusChip label={patient.statusLabel} tone={patient.statusTone} />
          </View>
        </View>
      </View>

      <View className="h-px bg-[#EDE7DF] my-3" />

      {patient.note ? (
        <Text className="text-[12.5px] text-[#E05A4E] mb-2.5">{patient.note}</Text>
      ) : null}

      <View className="flex-row flex-wrap">
        {visibleTags.map((tag, index) => (
          <MedicationTag key={`${tag}-${index}`} label={tag} accent={index < 2 && patient.statusTone !== 'done'} />
        ))}
      </View>

      {hiddenTagCount ? (
        <Text className="text-[12px] text-[#6B6560] mt-2">+{hiddenTagCount} more items</Text>
      ) : null}
    </TouchableOpacity>
  )
}


export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { patients, fetchPatients } = usePatientStore()
  const {
    scheduleGroups,
    pendingCount,
    completedCount,
    fetchSchedule,
    skipDose,
    subscribeToRealtime,
  } = useMedicationStore()
  const { activeAlerts, fetchNotifications } = useNotificationStore()
  const { pending: pendingHandover, fetchPending, setPending } = useHandoverStore()
  const [refreshing, setRefreshing] = useState(false)
  const [alertsExpanded, setAlertsExpanded] = useState(true)
  const [selectedWardFilter, setSelectedWardFilter] = useState('all')
  const [wardOptions, setWardOptions] = useState<WardFilterOption[]>([])
  const [wardLabelById, setWardLabelById] = useState<Record<string, string>>({})

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const wardId = user?.ward_id ?? ''
  const wardScope = wardId

  const allTodayItems = scheduleGroups.flatMap((group) => group.items)
  const visualFallback = patients.length === 0 && allTodayItems.length === 0 && activeAlerts.length === 0

  const fetchWardOptions = useCallback(async (scopeWardId: string) => {
    try {
      let patientQuery = supabase
        .from('patients')
        .select('ward_id')
        .eq('status', 'active')
        .not('ward_id', 'is', null)

      if (scopeWardId) {
        patientQuery = patientQuery.eq('ward_id', scopeWardId)
      }

      const { data: patientRows, error: patientError } = await patientQuery
      if (patientError) throw patientError

      const counts = new Map<string, number>()
      for (const row of patientRows ?? []) {
        if (!row.ward_id) continue
        counts.set(row.ward_id, (counts.get(row.ward_id) ?? 0) + 1)
      }

      const wardIds = [...counts.keys()]
      if (wardIds.length === 0) {
        setWardOptions([])
        setWardLabelById({})
        return
      }

      const { data: wards } = await supabase
        .from('wards')
        .select('id, name, floor')
        .in('id', wardIds)

      const wardsById = new Map((wards ?? []).map((ward) => [ward.id, ward as Pick<WardsRow, 'name' | 'floor'>]))
      const labels = Object.fromEntries(
        wardIds.map((id) => [id, formatWardOptionLabel(id, wardsById.get(id))]),
      )

      setWardLabelById(labels)
      setWardOptions(
        wardIds
          .map((id) => ({
            id,
            label: labels[id],
            patientCount: counts.get(id) ?? 0,
          }))
          .filter((option) => option.patientCount > 0)
          .sort((a, b) => a.label.localeCompare(b.label)),
      )
    } catch {
      if (scopeWardId) {
        setWardOptions([{ id: scopeWardId, label: formatWardLabel(scopeWardId), patientCount: patients.length }])
        setWardLabelById({ [scopeWardId]: formatWardLabel(scopeWardId) })
      } else {
        setWardOptions([])
        setWardLabelById({})
      }
    }
  }, [patients.length])

  const loadData = useCallback(async () => {
    if (!user) return
    if (USE_MOCK) {
      setPending(MOCK_HANDOVER as unknown as ShiftHandoversRow)
    } else if (wardScope) {
      fetchPending(wardScope)
    }
    await Promise.all([
      fetchPatients(wardScope),
      fetchSchedule(wardScope, todayStr),
      fetchWardOptions(wardScope),
      user ? fetchNotifications(user.id) : Promise.resolve(),
    ])
  }, [fetchNotifications, fetchPatients, fetchPending, fetchSchedule, fetchWardOptions, setPending, todayStr, user, wardScope])

  useEffect(() => {
    loadData()
  }, [loadData])

  const realtimeUnsubRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    realtimeUnsubRef.current?.()
    if (!wardScope) {
      realtimeUnsubRef.current = null
      return
    }
    realtimeUnsubRef.current = subscribeToRealtime(wardScope, todayStr)
    return () => {
      realtimeUnsubRef.current?.()
      realtimeUnsubRef.current = null
    }
  }, [subscribeToRealtime, todayStr, wardScope])

  useEffect(() => {
    if (wardOptions.length === 1) {
      setSelectedWardFilter(wardOptions[0].id)
      return
    }

    if (selectedWardFilter !== 'all' && !wardOptions.some((option) => option.id === selectedWardFilter)) {
      setSelectedWardFilter('all')
    }
  }, [selectedWardFilter, wardOptions])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const liveAlertCards = useMemo<AlertCardData[]>(() => {
    const patientNameById = new Map(patients.map((patient) => [patient.id, patient.name]))
    return activeAlerts.slice(0, 2).map((alert, index) => ({
      id: alert.id,
      patientName: alert.patient_id ? patientNameById.get(alert.patient_id) ?? `Patient ${index + 1}` : `Patient ${index + 1}`,
      title: alert.title_th,
      medication: alert.body_th || 'Medication alert',
      detail: index === 0 ? 'Needs attention today' : 'Follow up required',
      footnote: alert.body_th,
      cta: index === 0 ? 'Notify 3 days in advance' : 'Check before next dose',
      ctaTone: index === 0 ? 'danger' : 'warning',
    }))
  }, [activeAlerts, patients])

  const livePatientCards = useMemo<DispensePatientCard[]>(() => {
    return patients
      .map((patient) => {
        const patientItems = allTodayItems.filter((item) => item.patient_id === patient.id)
        const pendingItems = patientItems.filter((item) => item.status === 'pending')
        const confirmedItems = patientItems.filter((item) => item.status === 'confirmed')
        const primaryItems = (pendingItems.length > 0 ? pendingItems : confirmedItems).slice(0, 3)
        const statusTone: DispensePatientCard['statusTone'] =
          pendingItems.length > 1 ? 'urgent' : pendingItems.length === 1 ? 'pending' : 'done'

        return {
          id: patient.id,
          name: patient.name,
          room: patient.room_number ? `Room ${patient.room_number}` : 'No room',
          age: getAge(patient.date_of_birth),
          wardId: patient.ward_id,
          ward: wardLabelById[patient.ward_id] ?? formatWardLabel(patient.ward_id),
          tablets: `${Math.max(patientItems.length, 1) * 4} tablets`,
          statusLabel: statusTone === 'urgent' ? 'Urgent' : statusTone === 'pending' ? 'Pending' : 'Dispensed',
          statusTone,
          tags: primaryItems.map((item) => item.medicine_name),
          note: statusTone === 'urgent' ? 'Medication has been changed - please check before dispensing' : undefined,
          moreCount: patientItems.length > primaryItems.length ? patientItems.length - primaryItems.length : undefined,
        }
      })
      .filter((patient) => patient.tags.length > 0)
      .sort((a, b) => {
        const order = { urgent: 0, pending: 1, done: 2 }
        return order[a.statusTone] - order[b.statusTone]
      })
      .slice(0, 3)
  }, [allTodayItems, patients, wardLabelById])

  const demoAlertCards: AlertCardData[] = [
    {
      id: 'demo-alert-1',
      patientName: 'Mr. Somchai',
      title: 'Medication running low',
      medication: 'Risperidone 2 mg, 4 tablets remaining',
      detail: 'Runs out on March 14',
      footnote: 'Notify 3 days in advance',
      cta: 'Notify 3 days in advance',
      ctaTone: 'danger',
    },
    {
      id: 'demo-alert-2',
      patientName: 'Mr. Polo',
      title: 'Scheduled medication',
      medication: 'Metformin 500 mg',
      detail: 'to be taken at 12:00 regularly',
      footnote: 'Next dose in 2 hours 18 minutes',
      cta: 'Next dose in 2 hours 18 minutes',
      ctaTone: 'danger',
    },
  ]

  const demoPatientCards: DispensePatientCard[] = [
    {
      id: 'p1',
      name: 'Mr. Somchai Wongsri',
      room: 'Room A-102',
      age: '78',
      wardId: 'ward-a',
      ward: 'Ward A',
      tablets: '12 tablets',
      statusLabel: 'Urgent',
      statusTone: 'urgent',
      tags: ['• Risperidone 2 mg', '• Take with food', '• Metoprolol'],
      moreCount: 3,
    },
    {
      id: 'p2',
      name: 'Mrs. Polo Suksan',
      room: 'Room B-201',
      age: '81',
      wardId: 'ward-b',
      ward: 'Ward B',
      tablets: '9 tablets',
      statusLabel: 'Pending',
      statusTone: 'pending',
      tags: ['• Amlodipine 5 mg (new)', '• Losartan 50 mg'],
      note: '⚠ Medication has been changed - please check before dispensing',
      moreCount: 4,
    },
    {
      id: 'p3',
      name: 'Mr. Mana Jai',
      room: 'Room B-203',
      age: '69',
      wardId: 'ward-b',
      ward: 'Ward B',
      tablets: '5 tablets',
      statusLabel: 'Dispensed',
      statusTone: 'done',
      tags: ['• Dementia medication', '• Aspirin 81 mg'],
    },
  ]

  const alertCards = visualFallback ? demoAlertCards : liveAlertCards
  const patientCards = visualFallback ? demoPatientCards : livePatientCards
  const demoWardOptions: WardFilterOption[] = [
    { id: 'ward-a', label: 'Ward A', patientCount: 1 },
    { id: 'ward-b', label: 'Ward B', patientCount: 2 },
  ]
  const filterOptions = visualFallback ? demoWardOptions : wardOptions
  const filteredPatientCards = patientCards.filter((patient) => {
    if (selectedWardFilter === 'all') return true
    return patient.wardId === selectedWardFilter
  })
  const visibleAlertCards = alertsExpanded ? alertCards : []
  const totalRecipients = visualFallback ? 154 : patients.length
  const distributedToday = visualFallback ? 34 : completedCount
  const needsAttention = visualFallback ? 154 : pendingCount
  const firstName = visualFallback ? 'Peeraya' : getFirstName(user?.name)
  const unreadCount = visualFallback ? 1 : Math.max(activeAlerts.length, 0)

  const openNotifications = (filter?: 'all' | 'stock') => {
    router.push({
      pathname: '/notifications',
      params: filter && filter !== 'all' ? { filter } : undefined,
    })
  }

  const openPatientDetail = (patientId: string) => {
    router.push(`/patient/${patientId}`)
  }

  const showPatientActions = (patient: DispensePatientCard) => {
    const patientPendingItems = allTodayItems.filter(
      (item) => item.patient_id === patient.id && item.status === 'pending' && !item.conflict_flag,
    )

    Alert.alert(
      patient.name,
      'Choose the next workflow for this patient.',
      [
        { text: 'View Profile', onPress: () => openPatientDetail(patient.id) },
        {
          text: 'Confirm Dose',
          onPress: () => router.push('/(tabs)/schedule'),
        },
        {
          text:
            patientPendingItems.length > 0
              ? `Skip ${patientPendingItems.length} pending`
              : 'Skip (no pending)',
          style: 'destructive',
          onPress: () => {
            if (!user || patientPendingItems.length === 0) return
            Alert.alert(
              'Skip pending doses?',
              `Mark all ${patientPendingItems.length} of today's pending doses for ${patient.name} as skipped?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Skip all',
                  style: 'destructive',
                  onPress: async () => {
                    let skipped = 0
                    let failed = 0
                    for (const item of patientPendingItems) {
                      try {
                        await skipDose(item, user.id)
                        skipped += 1
                      } catch {
                        failed += 1
                      }
                    }
                    await loadData()
                    Alert.alert(
                      'Skipped',
                      failed > 0
                        ? `Skipped ${skipped}; ${failed} failed.`
                        : `Skipped ${skipped} dose${skipped === 1 ? '' : 's'}.`,
                    )
                  },
                },
              ],
            )
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  const showAlertActions = (alert: AlertCardData) => {
    Alert.alert(
      alert.patientName,
      alert.title,
      [
        { text: 'Open Alerts', onPress: () => openNotifications('all') },
        { text: 'Open Ward', onPress: () => router.push('/patients') },
        { text: 'Cancel', style: 'cancel' },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FBF0E3' }}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <SafeAreaView className="flex-1" edges={['left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: '#FBF0E3' }}
        contentContainerStyle={{ paddingBottom: Math.max(16, insets.bottom + 16) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8721A" />}
      >
        <LinearGradient
          colors={['#FBF0E3', '#F2A65A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ paddingTop: insets.top + 16 }}
          className="px-5 pb-6"
        >

          <View className="flex-row items-start justify-between pt-1 px-6 py-3">
            <View className="flex-1 pr-4">
              <Text className="text-[14px] text-[#38332E]">{getGreeting(today)}</Text>
              <View className="flex-row items-center mt-1">
                <Text style={[typo.headlineSmall, { color: colors.text }]}>{firstName}</Text>
                <Ionicons name="chevron-down" size={16} color="#2E2C2A" style={{ marginLeft: 3 }} />
              </View>

              <View className="flex-row items-center mt-2">
                <SystemIcon />
                <Text className="text-[12px] text-[#2E2C2A] ml-1.5">
                  {formatHeaderDate(today)} • {getDoseLabel(today)}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => openNotifications('all')} className="w-11 h-11 rounded-full bg-white items-center justify-center mt-1">
              <Ionicons name="notifications-outline" size={20} color="#2E2C2A" />
              {unreadCount > 0 ? (
                <View className="absolute top-2 right-2 min-w-[14px] h-[14px] rounded-full bg-[#FF4E4E] items-center justify-center px-0.5">
                  <Text className="text-[9px] font-bold text-white">{unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View className="mt-5 px-3 flex-row gap-3">
            <View
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: 18,
                padding: 6,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}
            >
              <StatCard
                label="Total Recipients"
                value={totalRecipients}
                SvgIcon={PillIcon}
                iconBg="#FFFFFF"
                iconColor="#2E2C2A"
                gradient={{ colors: ['#FFFFFF', '#F1F1F1'], start: { x: 0, y: 1 }, end: { x: 0, y: 0 } }}
                onPress={() => router.push('/patients')}
              />
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: 18,
                padding: 6,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}
            >
              <StatCard
                label="Distributed Today"
                value={distributedToday}
                SvgIcon={HourglassIcon}
                iconBg="#FFFFFF"
                iconColor="#1B8C67"
                gradient={{ colors: ['#E3FCEA', '#E3FCEA00'], start: { x: 0, y: 0 }, end: { x: 0, y: 1 } }}
                onPress={() => router.push('/schedule')}
              />
            </View>
          </View>
          
          <View className="px-4 pt-2 pb-4">
            <LinearGradient
              colors={['#FFFFFF', '#FFE6E6']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#F1F1F1',
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <TouchableOpacity
                onPress={() => router.push('/schedule')}
                activeOpacity={0.88}
                style={{ borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <AlarmClockIcon width={22} height={22} color="#FF6B6B" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, color: '#2E2C2A', fontWeight: '500' }}>Needs Attention</Text>
                    <Text style={{ fontSize: 26, fontWeight: '700', color: '#FF5A52', lineHeight: 32 }}>{needsAttention}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#3E3A37" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </LinearGradient>

        {pendingHandover ? (
          <View className="px-4 pt-4">
            <TouchableOpacity
              onPress={() => router.push('/handover')}
              activeOpacity={0.9}
              style={{
                flexDirection: 'row',
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#EADBCB',
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <View style={{ width: 6, backgroundColor: '#C96B1A' }} />
              <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE6CC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="swap-horizontal" size={22} color="#8E4B14" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#8E4B14', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {(() => {
                      const hour = new Date(pendingHandover.shift_start).getHours()
                      if (hour >= 6 && hour < 14) return 'เวรเช้า / Morning shift'
                      if (hour >= 14 && hour < 22) return 'เวรบ่าย / Afternoon shift'
                      return 'เวรดึก / Night shift'
                    })()}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#2E241B', marginTop: 2 }}>
                    ยืนยันการรับเวร / Acknowledge handover
                  </Text>
                  {(() => {
                    const summary = pendingHandover.summary_json as Record<string, unknown> | undefined
                    const pending = (summary?.pending_medications as unknown[] | undefined)?.length ?? 0
                    if (pending === 0) return null
                    return (
                      <Text style={{ fontSize: 12, color: '#A3322A', marginTop: 4 }}>
                        🔴 {pending} ยาค้าง / pending dose{pending > 1 ? 's' : ''}
                      </Text>
                    )
                  })()}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8E4B14" />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="px-6 pt-6">
          <View className="flex-row justify-between mb-6">
            <ActionItem SvgIcon={DoubleCheckIcon} label={'Double\nCheck'} onPress={() => router.push('/schedule')} />
            <ActionItem SvgIcon={ScanMedicationIcon} label={'Scan\nMedication'} onPress={() => router.push('/scanner')} />
            <ActionItem SvgIcon={LowStockIcon} label={'Low Stock'} onPress={() => openNotifications('stock')} />
            <ActionItem SvgIcon={OrderIcon} label={'Order'} onPress={() => router.push('/report')} />
          </View>

          <Card className="bg-[#FFFDF9] shadow-sm mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Text className="text-[20px] mr-2">⚠️</Text>
                <Text className="text-[16px] font-semibold text-[#262321]">Urgent Alerts</Text>
              </View>
              <TouchableOpacity onPress={() => setAlertsExpanded((current) => !current)} className="w-8 h-8 rounded-full bg-white border border-[#EFE6DB] items-center justify-center">
                <Ionicons name={alertsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#484440" />
              </TouchableOpacity>
            </View>

            {visibleAlertCards.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onPress={() => openNotifications('all')}
                onMorePress={() => showAlertActions(alert)}
              />
            ))}

            <TouchableOpacity onPress={() => openNotifications('all')} className="rounded-[12px] border border-[#E5DDD3] bg-white py-3 items-center">
              <Text className="text-[14px] font-semibold text-[#343230]">View All</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View className="bg-white pt-6 pb-4">
          <View className="px-6">
            <View className="flex-row items-center mb-4">
              <Text className="text-[20px] mr-2">💊</Text>
              <Text className="text-[16px] font-bold text-[#1E1C1A]">Patients to Dispense Medication</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row">
                {filterOptions.length > 1 ? (
                  <TouchableOpacity onPress={() => setSelectedWardFilter('all')} className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === 'all' ? 'bg-[#F5A74F]' : 'bg-white border border-[#ECE4D9]'}`}>
                    <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                    <Text className="text-[13px] text-[#1F1D1B] ml-2">All Wards</Text>
                  </TouchableOpacity>
                ) : null}
                {filterOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setSelectedWardFilter(option.id)}
                    className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === option.id || (selectedWardFilter === 'all' && filterOptions.length === 1) ? 'bg-[#F5A74F]' : 'bg-white border border-[#ECE4D9]'}`}
                  >
                    <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                    <Text className="text-[13px] text-[#1F1D1B] ml-2">{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {filteredPatientCards.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onPress={() => openPatientDetail(patient.id)}
                onMorePress={() => showPatientActions(patient)}
              />
            ))}

            <TouchableOpacity onPress={() => router.push('/patients')} className="rounded-[12px] bg-[#F5A74F] py-4 items-center mt-2">
              <Text className="text-[15px] font-semibold text-[#22201E]">View All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    <TouchableOpacity
      accessibilityLabel="Voice assistant"
      onPress={() => router.push('/voice')}
      activeOpacity={0.85}
      style={{
        position: 'absolute',
        right: 16,
        bottom: Math.max(96, insets.bottom + 80),
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E8721A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}
    >
      <Ionicons name="mic" size={26} color="#fff" />
    </TouchableOpacity>
    <BottomNav
      activeTab="home"
      onHome={() => router.replace('/(tabs)')}
      onWard={() => router.replace('/(tabs)/patients')}
      onProfile={() => router.replace('/(tabs)/settings')}
    />
    </View>
  )
}
