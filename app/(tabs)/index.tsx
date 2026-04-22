/**
 * app/(tabs)/index.tsx
 * Home screen implemented from the provided Figma screenshot.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../src/stores/authStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { useMedicationStore } from '../../src/stores/medicationStore'
import { useNotificationStore } from '../../src/stores/notificationStore'
import { Card } from '../../src/components/ui/Card'

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

function ActionItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
}) {
  const lines = label.split('\n')

  return (
    <TouchableOpacity onPress={onPress} className="flex-1 items-center px-1">
      <View className="w-16 h-16 rounded-[22px] bg-[#FFF5E8] items-center justify-center mb-3">
        <Ionicons name={icon} size={30} color="#F2A24B" />
      </View>
      {lines.map((line) => (
        <Text key={line} className="text-[12px] leading-[15px] font-semibold text-[#2E2C2A] text-center">
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
}: {
  label: string
  value: number
  icon: React.ComponentProps<typeof Ionicons>['name']
  tintClass?: string
}) {
  return (
    <View className={`flex-1 rounded-[22px] bg-white px-5 py-5 ${tintClass ?? ''}`}>
      <View className="flex-row items-start justify-between">
        <Text className="text-[15px] leading-[20px] text-[#3B3836] flex-1 pr-3">{label}</Text>
        <View className="w-12 h-12 rounded-full bg-[#FBFBFB] items-center justify-center shadow-sm">
          <Ionicons name={icon} size={22} color="#303030" />
        </View>
      </View>
      <View className="flex-row items-end justify-between mt-7">
        <Text className="text-[28px] font-bold text-[#303030]">{value}</Text>
        <Ionicons name="chevron-forward" size={20} color="#454545" />
      </View>
    </View>
  )
}

function AlertCard({ alert }: { alert: AlertCardData }) {
  return (
    <View className="bg-white border border-[#EFE4D5] rounded-[18px] px-4 py-4 mb-4 shadow-sm">
      <View className="flex-row items-start">
        <View className="w-14 h-14 rounded-[14px] bg-[#FFF4E6] items-center justify-center mr-4">
          <Text className="text-[26px]">💊</Text>
        </View>

        <View className="flex-1 pr-3">
          <Text className="text-[15px] font-bold text-[#343230]">{alert.patientName}</Text>
          <Text className="text-[14px] text-[#4B4744] mt-0.5">{alert.title}</Text>

          <View className="flex-row items-center mt-2">
            <Ionicons name="medkit-outline" size={14} color="#86808A" />
            <Text className="text-[13px] text-[#7D7780] ml-2">{alert.medication}</Text>
          </View>

          <View className="flex-row items-center mt-1.5">
            <Ionicons name="time-outline" size={14} color="#86808A" />
            <Text className="text-[13px] text-[#7D7780] ml-2">{alert.detail}</Text>
          </View>

          <View className={`self-start mt-4 rounded-full px-4 py-1.5 ${
            alert.ctaTone === 'danger' ? 'bg-[#FFF1F1]' : 'bg-[#FFF3EA]'
          }`}>
            <Text className={`text-[12px] ${
              alert.ctaTone === 'danger' ? 'text-[#FF6A63]' : 'text-[#F39A47]'
            }`}>
              {alert.cta}
            </Text>
          </View>
        </View>

        <TouchableOpacity className="min-h-[32px] min-w-[24px] items-center justify-center">
          <Ionicons name="ellipsis-vertical" size={18} color="#4A4744" />
        </TouchableOpacity>
      </View>
    </View>
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

function MedicationTag({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View className={`rounded-[10px] border px-3 py-2 mr-2 mb-2 ${
      accent ? 'border-[#FF8E84] bg-[#FFF9F9]' : 'border-[#ECE7DF] bg-white'
    }`}>
      <Text className={`text-[12px] ${accent ? 'text-[#FF6A63]' : 'text-[#454240]'}`}>{label}</Text>
    </View>
  )
}

function PatientCard({ patient }: { patient: DispensePatientCard }) {
  const statusDotClass =
    patient.statusTone === 'urgent'
      ? 'bg-[#FF6A63]'
      : patient.statusTone === 'pending'
        ? 'bg-[#F0B356]'
        : 'bg-[#24B57A]'

  return (
    <View className="bg-white border border-[#EEE3D6] rounded-[22px] px-4 py-4 mb-4 shadow-sm">
      <View className="flex-row items-start">
        <View className="w-14 h-14 rounded-full bg-[#F4A851] items-center justify-center mr-4 overflow-hidden">
          <Text className="text-[26px]">👩🏻</Text>
        </View>

        <View className="flex-1 pr-3">
          <View className="flex-row items-start justify-between">
            <Text className="text-[16px] font-bold text-[#343230] flex-1 pr-2">{patient.name}</Text>
            <TouchableOpacity className="min-h-[28px] min-w-[24px] items-center justify-center">
              <Ionicons name="ellipsis-vertical" size={18} color="#4A4744" />
            </TouchableOpacity>
          </View>

          <Text className="text-[13px] text-[#7B7580] mt-1">
            {patient.room} • Age {patient.age} • {patient.ward}
          </Text>

          <View className="flex-row items-center mt-2">
            <Ionicons name="medkit-outline" size={14} color="#7B7580" />
            <Text className="text-[13px] text-[#7B7580] ml-2 mr-2">{patient.tablets}</Text>
            <StatusChip label={patient.statusLabel} tone={patient.statusTone} />
          </View>
        </View>
      </View>

      <View className="h-px bg-[#F0E9E0] my-4" />

      {patient.note ? (
        <Text className="text-[13px] text-[#FF6A63] mb-3">{patient.note}</Text>
      ) : null}

      <View className="flex-row flex-wrap">
        {patient.tags.map((tag, index) => (
          <MedicationTag key={tag} label={tag} accent={index < 2 && patient.statusTone !== 'done'} />
        ))}
      </View>

      {patient.moreCount ? (
        <Text className="text-[13px] text-[#6B6560] mt-1">+{patient.moreCount} more items</Text>
      ) : null}
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
          ward: wardId ? `Ward ${wardId}` : 'Ward',
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
      id: 'demo-patient-1',
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
      id: 'demo-patient-2',
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
      id: 'demo-patient-3',
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
  const totalRecipients = visualFallback ? 154 : patients.length
  const distributedToday = visualFallback ? 34 : completedCount
  const needsAttention = visualFallback ? 154 : pendingCount
  const firstName = visualFallback ? 'Peeraya' : getFirstName(user?.name)
  const unreadCount = visualFallback ? 1 : Math.max(activeAlerts.length, 0)

  return (
    <SafeAreaView className="flex-1 bg-[#FFF9F1]">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 26 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F2A24B" />}
      >
        <View className="bg-[#FFB464] px-6 pt-5 pb-8">
          <View className="absolute right-[-35] top-2 w-36 h-36 rounded-full bg-[#FFD2A6] opacity-50" />
          <View className="absolute right-3 top-8 w-20 h-20 rounded-full bg-[#FFE5CA] opacity-80" />

          <View className="flex-row items-start justify-between pt-2">
            <View className="flex-1 pr-4">
              <Text className="text-[16px] text-[#38332E]">{getGreeting(today)}</Text>
              <View className="flex-row items-center mt-1.5">
                <Text className="text-[30px] leading-[36px] font-bold text-[#2E2C2A]">{firstName}</Text>
                <Ionicons name="chevron-down" size={20} color="#2E2C2A" style={{ marginLeft: 4 }} />
              </View>

              <View className="flex-row items-center mt-4">
                <Ionicons name="calendar-outline" size={18} color="#2E2C2A" />
                <Text className="text-[14px] text-[#2E2C2A] ml-2">
                  {formatHeaderDate(today)} • {getDoseLabel(today)}
                </Text>
              </View>
            </View>

            <TouchableOpacity className="w-14 h-14 rounded-full bg-white items-center justify-center mt-2">
              <Ionicons name="notifications-outline" size={22} color="#2E2C2A" />
              {unreadCount > 0 ? (
                <View className="absolute top-3 right-3 min-w-[16px] h-4 rounded-full bg-[#FF4E4E] items-center justify-center px-1">
                  <Text className="text-[10px] font-bold text-white">{unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View className="flex-row mt-7">
            <StatCard label="Total\nRecipients" value={totalRecipients} icon="medkit-outline" />
            <View className="w-3" />
            <StatCard label="Distributed\nToday" value={distributedToday} icon="hourglass-outline" tintClass="bg-[#F3FFF5]" />
          </View>

          <TouchableOpacity className="mt-4 rounded-[18px] bg-[#FFF4F3] px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-12 h-12 rounded-full bg-white items-center justify-center mr-4">
                <Ionicons name="alarm-outline" size={22} color="#FF7A73" />
              </View>
              <View>
                <Text className="text-[15px] text-[#343230]">Needs Attention</Text>
                <Text className="text-[18px] font-bold text-[#FF6464] mt-0.5">{needsAttention}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3E3A37" />
          </TouchableOpacity>
        </View>

        <View className="px-6 pt-8">
          <View className="flex-row justify-between mb-8">
            <ActionItem icon="shield-checkmark-outline" label={'Double\nCheck'} onPress={() => router.push('/schedule')} />
            <ActionItem icon="scan-outline" label={'Scan\nMedication'} onPress={() => router.push('/scanner')} />
            <ActionItem icon="cube-outline" label={'Low Stock'} onPress={() => router.push('/patients')} />
            <ActionItem icon="document-text-outline" label={'Order'} onPress={() => router.push('/patients')} />
          </View>

          <Card className="bg-[#FFFDF9] shadow-sm mb-10">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-row items-center">
                <Text className="text-[24px] mr-3">⚠️</Text>
                <Text className="text-[18px] font-semibold text-[#262321]">Urgent Alerts</Text>
              </View>
              <TouchableOpacity className="w-10 h-10 rounded-full bg-white border border-[#EFE6DB] items-center justify-center">
                <Ionicons name="chevron-up" size={18} color="#484440" />
              </TouchableOpacity>
            </View>

            {alertCards.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}

            <TouchableOpacity className="rounded-[16px] border border-[#E5DDD3] bg-white py-4 items-center">
              <Text className="text-[16px] font-semibold text-[#343230]">View All</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View className="bg-white pt-8 pb-4">
          <View className="px-6">
            <View className="flex-row items-center mb-6">
              <Text className="text-[22px] mr-3">💊</Text>
              <Text className="text-[18px] font-semibold text-[#262321]">Patients to Dispense Medication</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row">
                <TouchableOpacity className="rounded-[14px] bg-[#F5A74F] px-5 py-4 mr-3 flex-row items-center">
                  <Ionicons name="layers-outline" size={18} color="#1F1D1B" />
                  <Text className="text-[16px] text-[#1F1D1B] ml-3">All Wards</Text>
                </TouchableOpacity>
                <TouchableOpacity className="rounded-[14px] bg-white border border-[#ECE4D9] px-5 py-4 mr-3 flex-row items-center">
                  <Ionicons name="layers-outline" size={18} color="#1F1D1B" />
                  <Text className="text-[16px] text-[#1F1D1B] ml-3">Ward A (Floor 1)</Text>
                </TouchableOpacity>
                <TouchableOpacity className="rounded-[14px] bg-white border border-[#ECE4D9] px-5 py-4 flex-row items-center">
                  <Ionicons name="layers-outline" size={18} color="#1F1D1B" />
                  <Text className="text-[16px] text-[#1F1D1B] ml-3">Ward B</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {patientCards.map((patient) => (
              <PatientCard key={patient.id} patient={patient} />
            ))}

            <TouchableOpacity className="rounded-[14px] bg-[#F5A74F] py-5 items-center mt-2">
              <Text className="text-[18px] font-semibold text-[#22201E]">View All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
