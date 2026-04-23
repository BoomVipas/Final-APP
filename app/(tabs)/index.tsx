/**
 * app/(tabs)/index.tsx
 * Home screen implemented from the provided Figma screenshot.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Image, ImageBackground, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import DoubleCheckIcon from '../../icons/DoubleCheckIcon'
import ScanMedicationIcon from '../../icons/ScanMedicationIcon'
import LowStockIcon from '../../icons/LowStockIcon'
import OrderIcon from '../../icons/OrderIcon'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { useNotificationStore } from '../../src/stores/notificationStore'
import { Card } from '../../src/components/ui/Card'
import { PatientAvatar } from '../../src/components/shared/PatientAvatar'
import HomeIcon from '../../icons/Home.png'
import WardIcon from '../../icons/Ward.png'
import ProfileIcon from '../../icons/Profile.png'
import BackgroundImg from '../../icons/Background.png'

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
  ward: string
  tablets: string
  statusLabel: string
  statusTone: 'urgent' | 'pending' | 'done'
  tags: string[]
  note?: string
  moreCount?: number
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
      <View className="w-[54px] h-[54px] rounded-[18px] bg-[#FFF5E8] overflow-hidden mb-2">
        <SvgIcon width={54} height={54} />
      </View>
      {lines.map((line, i) => (
        <Text key={i} className="text-[11px] leading-[14px] font-semibold text-[#2E2C2A] text-center">
          {line}
        </Text>
      ))}
    </TouchableOpacity>
  )
}

function StatCard({
  label,
  value,
  icon,
  tintClass,
  gradient,
  onPress,
}: {
  label: string
  value: number
  icon: React.ComponentProps<typeof Ionicons>['name']
  tintClass?: string
  gradient?: boolean | string[]
  onPress: () => void
}) {
  const inner = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{ flex: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16 }}
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-[13px] leading-[18px] text-[#3B3836] flex-1 pr-2">{label}</Text>
        <View className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center">
          <Ionicons name={icon} size={18} color="#303030" />
        </View>
      </View>
      <View className="flex-row items-end justify-between mt-3">
        <Text className="text-[26px] font-bold text-[#303030]">{value}</Text>
        <Ionicons name="chevron-forward" size={18} color="#454545" />
      </View>
    </TouchableOpacity>
  )

  if (gradient) {
    const gradientColors = Array.isArray(gradient) ? gradient : ['#F1F1F1', '#FFFFFF']
    return (
      <LinearGradient
        colors={gradientColors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1, borderRadius: 18 }}
      >
        {inner}
      </LinearGradient>
    )
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className={`flex-1 rounded-[18px] bg-white px-4 py-4 ${tintClass ?? ''}`}
    >
      <View className="flex-row items-start justify-between">
        <Text className="text-[13px] leading-[18px] text-[#3B3836] flex-1 pr-2">{label}</Text>
        <View className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center">
          <Ionicons name={icon} size={18} color="#303030" />
        </View>
      </View>
      <View className="flex-row items-end justify-between mt-3">
        <Text className="text-[26px] font-bold text-[#303030]">{value}</Text>
        <Ionicons name="chevron-forward" size={18} color="#454545" />
      </View>
    </TouchableOpacity>
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
      className="bg-white border border-[#EFE4D5] rounded-[18px] px-4 py-4 mb-4 shadow-sm"
    >
      <View className="flex-row items-start">
        <View className="w-12 h-12 rounded-[12px] bg-[#FFF4E6] items-center justify-center mr-3">
          <Text className="text-[22px]">💊</Text>
        </View>

        <View className="flex-1 pr-2">
          <Text className="text-[14px] font-bold text-[#343230]">{alert.patientName}</Text>
          <Text className="text-[13px] text-[#4B4744] mt-0.5">{alert.title}</Text>

          <View className="flex-row items-center mt-1.5">
            <Ionicons name="medkit-outline" size={13} color="#86808A" />
            <Text className="text-[12px] text-[#7D7780] ml-1.5">{alert.medication}</Text>
          </View>

          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={13} color="#86808A" />
            <Text className="text-[12px] text-[#7D7780] ml-1.5">{alert.detail}</Text>
          </View>

          <View className={`self-start mt-3 rounded-full px-3 py-1 ${
            alert.ctaTone === 'danger' ? 'bg-[#FFF1F1]' : 'bg-[#FFF3EA]'
          }`}>
            <Text className={`text-[11px] ${
              alert.ctaTone === 'danger' ? 'text-[#FF6A63]' : 'text-[#F39A47]'
            }`}>
              🔔 {alert.cta}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onMorePress} className="min-h-[28px] min-w-[20px] items-center justify-center">
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
      className="bg-white border border-[#EEE3D6] rounded-[22px] px-4 py-4 mb-4 shadow-sm"
    >
      <View className="flex-row items-start">
        <PatientAvatar name={patient.name} size={48} className="mr-3" />

        <View className="flex-1 pr-2">
          <View className="flex-row items-start justify-between">
            <Text className="text-[14px] font-bold text-[#343230] flex-1 pr-2">{patient.name}</Text>
            <TouchableOpacity onPress={onMorePress} className="min-h-[28px] min-w-[20px] items-center justify-center">
              <Ionicons name="ellipsis-vertical" size={16} color="#4A4744" />
            </TouchableOpacity>
          </View>

          <Text className="text-[12px] text-[#7B7580] mt-0.5">
            {patient.room} • Age {patient.age} • {patient.ward}
          </Text>

          <View className="flex-row items-center mt-1.5">
            <Ionicons name="medkit-outline" size={13} color="#7B7580" />
            <Text className="text-[12px] text-[#7B7580] ml-1.5 mr-2">{patient.tablets}</Text>
            <StatusChip label={patient.statusLabel} tone={patient.statusTone} />
          </View>
        </View>
      </View>

      <View className="h-px bg-[#F0E9E0] my-4" />

      {patient.note ? (
        <Text className="text-[13px] text-[#FF6A63] mb-3">{patient.note}</Text>
      ) : null}

      <View className="flex-row overflow-hidden">
        {visibleTags.map((tag, index) => (
          <MedicationTag key={`${tag}-${index}`} label={tag} accent={index < 2 && patient.statusTone !== 'done'} />
        ))}
      </View>

      {hiddenTagCount ? (
        <Text className="text-[13px] text-[#6B6560] mt-3">+{hiddenTagCount} more items</Text>
      ) : null}
    </TouchableOpacity>
  )
}

function BottomNav({ onHome, onWard, onProfile }: { onHome: () => void; onWard: () => void; onProfile: () => void }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE5DB', paddingHorizontal: 32, paddingTop: 12, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={onHome} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={HomeIcon} style={{ width: 30, height: 30, tintColor: '#F2A14C' }} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#2F2F2F', marginTop: 6 }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onWard} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={WardIcon} style={{ width: 30, height: 30, tintColor: '#2F2F2F' }} />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Ward</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfile} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={ProfileIcon} style={{ width: 30, height: 30, tintColor: '#2F2F2F' }} />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 6, width: 128, borderRadius: 999, backgroundColor: '#000000', alignSelf: 'center', marginTop: 16 }} />
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { patients, fetchPatients } = usePatientStore()
  const { scheduleGroups, pendingCount, completedCount, fetchSchedule } = useMedicationStore()
  const { activeAlerts, fetchNotifications } = useNotificationStore()
  const [refreshing, setRefreshing] = useState(false)
  const [alertsExpanded, setAlertsExpanded] = useState(true)
  const [selectedWardFilter, setSelectedWardFilter] = useState<'all' | 'ward-a' | 'ward-b'>('all')

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const wardId = user?.ward_id ?? ''

  const allTodayItems = scheduleGroups.flatMap((group) => group.items)
  const visualFallback = patients.length === 0 && allTodayItems.length === 0 && activeAlerts.length === 0

  const loadData = useCallback(async () => {
    if (!wardId) return
    await Promise.all([
      fetchPatients(wardId),
      fetchSchedule(wardId, todayStr),
      user ? fetchNotifications(user.id) : Promise.resolve(),
    ])
  }, [fetchNotifications, fetchPatients, fetchSchedule, todayStr, user, wardId])

  useEffect(() => {
    loadData()
  }, [loadData])

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
          ward: formatWardLabel(wardId),
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
  }, [allTodayItems, patients, wardId])

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
      ward: 'Ward B',
      tablets: '5 tablets',
      statusLabel: 'Dispensed',
      statusTone: 'done',
      tags: ['• Dementia medication', '• Aspirin 81 mg'],
    },
  ]

  const alertCards = visualFallback ? demoAlertCards : liveAlertCards
  const patientCards = visualFallback ? demoPatientCards : livePatientCards
  const filteredPatientCards = patientCards.filter((patient) => {
    if (selectedWardFilter === 'all') return true
    if (selectedWardFilter === 'ward-a') return patient.ward.toLowerCase().includes('ward a')
    return patient.ward.toLowerCase().includes('ward b')
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
    Alert.alert(
      patient.name,
      'Choose the next workflow for this patient.',
      [
        { text: 'View Profile', onPress: () => openPatientDetail(patient.id) },
        { text: 'Open Ward', onPress: () => router.push('/patients') },
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
    <View style={{ flex: 1, backgroundColor: '#FFF9F1' }}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <SafeAreaView className="flex-1" edges={['left', 'right']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F2A24B" />}
      >
        <ImageBackground source={BackgroundImg} className="px-6 pt-12 pb-8" resizeMode="cover" imageStyle={{ width: '100%', height: '100%' }}>

          <View className="flex-row items-start justify-between pt-1">
            <View className="flex-1 pr-4">
              <Text className="text-[13px] text-[#38332E]">{getGreeting(today)}</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-[24px] leading-[30px] font-bold text-[#2E2C2A]">{firstName}</Text>
                <Ionicons name="chevron-down" size={16} color="#2E2C2A" style={{ marginLeft: 3 }} />
              </View>

              <View className="flex-row items-center mt-2">
                <Ionicons name="calendar-outline" size={14} color="#2E2C2A" />
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

          <View className="flex-row mt-5 gap-3">
            <StatCard label="Total Recipients" value={totalRecipients} icon="medkit-outline" gradient onPress={() => router.push('/patients')} />
            <StatCard label="Distributed Today" value={distributedToday} icon="hourglass-outline" gradient={['#E4FFF8', '#FFFFFF']} onPress={() => router.push('/schedule')} />
          </View>

          <TouchableOpacity onPress={() => router.push('/schedule')} className="mt-3 rounded-[14px] bg-[#FFF4F3] px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3">
                <Ionicons name="alarm-outline" size={18} color="#FF7A73" />
              </View>
              <View>
                <Text className="text-[13px] text-[#343230]">Needs Attention</Text>
                <Text className="text-[16px] font-bold text-[#FF6464]">{needsAttention}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#3E3A37" />
          </TouchableOpacity>
        </ImageBackground>

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
              <Text className="text-[18px] mr-2">💊</Text>
              <Text className="text-[16px] font-semibold text-[#262321]">Patients to Dispense Medication</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row">
                <TouchableOpacity onPress={() => setSelectedWardFilter('all')} className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === 'all' ? 'bg-[#F5A74F]' : 'bg-white border border-[#ECE4D9]'}`}>
                  <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                  <Text className="text-[13px] text-[#1F1D1B] ml-2">All Wards</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedWardFilter('ward-a')} className={`rounded-[10px] px-4 py-2.5 mr-2 flex-row items-center ${selectedWardFilter === 'ward-a' ? 'bg-[#F5A74F]' : 'bg-white border border-[#ECE4D9]'}`}>
                  <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                  <Text className="text-[13px] text-[#1F1D1B] ml-2">Ward A (Floor 1)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedWardFilter('ward-b')} className={`rounded-[10px] px-4 py-2.5 flex-row items-center ${selectedWardFilter === 'ward-b' ? 'bg-[#F5A74F]' : 'bg-white border border-[#ECE4D9]'}`}>
                  <Ionicons name="layers-outline" size={15} color="#1F1D1B" />
                  <Text className="text-[13px] text-[#1F1D1B] ml-2">Ward B</Text>
                </TouchableOpacity>
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
    <BottomNav
      onHome={() => router.replace('/(tabs)')}
      onWard={() => router.replace('/(tabs)/patients')}
      onProfile={() => router.replace('/(tabs)/settings')}
    />
    </View>
  )
}
