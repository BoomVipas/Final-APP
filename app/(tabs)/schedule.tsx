/**
 * app/(tabs)/schedule.tsx
 * Ward-level medication schedule grouped by meal period with confirmation flow.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleGroup, type ScheduleItem } from '../../src/stores/medicationStore'
import { MedicationCard } from '../../src/components/shared/MedicationCard'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'

type AdminMethod = 'normal' | 'crushed' | 'feeding_tube'

const METHOD_LABELS: Record<AdminMethod, string> = {
  normal: 'Normal',
  crushed: 'Crushed',
  feeding_tube: 'Feeding tube',
}

function formatDateEnglish(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function ConfirmBottomSheet({
  item,
  visible,
  onClose,
  onSubmit,
}: {
  item: ScheduleItem | null
  visible: boolean
  onClose: () => void
  onSubmit: (item: ScheduleItem, method: AdminMethod) => Promise<void>
}) {
  const [selectedMethod, setSelectedMethod] = useState<AdminMethod>('normal')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!item) return
    setSubmitting(true)
    await onSubmit(item, selectedMethod)
    setSubmitting(false)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/35" onPress={onClose}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF9F2] rounded-t-[32px] px-5 pt-5 pb-7">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">
            Confirm Dose
          </Text>
          <Text className="text-xl font-bold text-[#2E241B] mt-2">Confirm Medication</Text>
          {item ? (
            <Text className="text-sm text-[#6F6254] mt-2">
              {item.medicine_name}  •  {item.patient_name}
            </Text>
          ) : null}

          <Text className="text-sm font-semibold text-[#5E5145] mt-5 mb-3">Administration Method</Text>
          <View className="flex-row mb-6">
            {(Object.keys(METHOD_LABELS) as AdminMethod[]).map((method, index) => {
              const isActive = selectedMethod === method
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => setSelectedMethod(method)}
                  className={`flex-1 min-h-[50px] rounded-[20px] border items-center justify-center ${
                    isActive
                      ? 'border-[#C96B1A] bg-[#FFF0DD]'
                      : 'border-[#EADBCB] bg-[#FFFDF8]'
                  }`}
                  style={{ marginRight: index === 2 ? 0 : 10 }}
                >
                  <Text className={`text-sm font-semibold ${isActive ? 'text-[#8E4B14]' : 'text-[#6F6254]'}`}>
                    {METHOD_LABELS[method]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Button
            title="Confirm"
            onPress={handleSubmit}
            variant="primary"
            loading={submitting}
            disabled={submitting}
          />
          <Button title="Cancel" onPress={onClose} variant="ghost" className="mt-2" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function DuplicateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <View className="bg-[#FFF9F2] border border-[#F2C7C3] rounded-[28px] p-6 w-full">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#A3322A] text-center">
            Duplicate Guard
          </Text>
          <Text className="text-lg font-bold text-[#2E241B] text-center mt-2">
            Duplicate Dose Detected
          </Text>
          <Text className="text-sm text-[#6F6254] text-center mt-2 mb-5">
            This confirmation was blocked to prevent giving the same medication twice in this time slot.
          </Text>
          <Button title="Understood" onPress={onClose} variant="danger" />
        </View>
      </View>
    </Modal>
  )
}

function PeriodSection({
  group,
  onConfirm,
}: {
  group: ScheduleGroup
  onConfirm: (item: ScheduleItem) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pendingCount = group.items.filter((item) => item.status === 'pending').length

  return (
    <Card className="mb-4 bg-[#FFF9F2]">
      <TouchableOpacity
        onPress={() => setCollapsed((value) => !value)}
        className="flex-row items-center justify-between min-h-[48px]"
      >
        <View className="flex-row items-center flex-1 pr-3">
          <View className="w-12 h-12 rounded-[18px] bg-[#F6EBDD] items-center justify-center mr-3">
            <Text className="text-xl">{group.emoji}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-[#2E241B]">{group.label_en}</Text>
            <Text className="text-xs text-[#7D6E60] mt-1">{group.items.length} scheduled items</Text>
          </View>
          {pendingCount > 0 ? (
            <View className="bg-[#FFF0D9] rounded-full px-3 py-1">
              <Text className="text-[11px] font-semibold text-[#A45A11]">
                {pendingCount} pending
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#8C8174" />
      </TouchableOpacity>

      {!collapsed ? (
        <View className="mt-4">
          {group.items.map((item) => (
            <MedicationCard
              key={`${item.prescription_id}:${item.meal_time}`}
              item={item}
              showPatientName
              onConfirm={onConfirm}
            />
          ))}
        </View>
      ) : null}
    </Card>
  )
}

export default function ScheduleScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule, confirmDose, subscribeToRealtime } = useMedicationStore()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [confirmItem, setConfirmItem] = useState<ScheduleItem | null>(null)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [loadingDate, setLoadingDate] = useState(false)

  const wardId = user?.ward_id ?? ''
  const dateStr = currentDate.toISOString().slice(0, 10)
  const unsubRef = useRef<(() => void) | null>(null)

  const loadSchedule = useCallback(async () => {
    if (!wardId) return
    setLoadingDate(true)
    await fetchSchedule(wardId, dateStr)
    setLoadingDate(false)
  }, [dateStr, fetchSchedule, wardId])

  useEffect(() => {
    loadSchedule()
    if (wardId) {
      unsubRef.current?.()
      unsubRef.current = subscribeToRealtime(wardId, dateStr)
    }

    return () => {
      unsubRef.current?.()
    }
  }, [dateStr, loadSchedule, subscribeToRealtime, wardId])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadSchedule()
    setRefreshing(false)
  }

  const handleConfirmPress = (item: ScheduleItem) => {
    if (item.conflict_flag) {
      setShowDuplicate(true)
      return
    }
    setConfirmItem(item)
  }

  const handleConfirmSubmit = async (item: ScheduleItem, _method: AdminMethod) => {
    if (!user) return

    try {
      await confirmDose({ ...item }, user.id)
      setConfirmItem(null)
      await loadSchedule()
    } catch {
      setConfirmItem(null)
      setShowDuplicate(true)
    }
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F6EFE6]">
      <View className="px-4 pt-3">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.85}
          className="w-12 h-12 rounded-full bg-[#FFF9F2] border border-[#EADBCB] items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#8E4B14" />
        </TouchableOpacity>
      </View>

      <View className="px-4 pt-3 pb-2">
        <Card className="bg-[#FFF3E5] border-[#E8CFB0]">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">
            Medication Schedule
          </Text>
          <Text className="text-[28px] leading-[34px] font-bold text-[#2E241B] mt-2">
            Schedule
          </Text>
          <Text className="text-sm text-[#6F6254] mt-2">
            Confirm medication in real time with duplicate-dose protection before saving.
          </Text>
        </Card>
      </View>

      <View className="px-4 pb-3">
        <Card className="bg-[#FFF9F2]">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setCurrentDate((date) => addDays(date, -1))}
              className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#F6EBDD]"
            >
              <Ionicons name="chevron-back" size={22} color="#8E4B14" />
            </TouchableOpacity>

            <View className="flex-1 px-4">
              <Text className="text-center text-base font-bold text-[#2E241B]">
                {formatDateEnglish(currentDate)}
              </Text>
              <Text className="text-center text-xs text-[#7D6E60] mt-1">
                {scheduleGroups.length} time groups
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setCurrentDate((date) => addDays(date, 1))}
              className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#F6EBDD]"
            >
              <Ionicons name="chevron-forward" size={22} color="#8E4B14" />
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      {loadingDate ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C96B1A" />
          <Text className="text-sm text-[#7D6E60] mt-3">Loading medication schedule...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C96B1A" />}
        >
          {scheduleGroups.length === 0 ? (
            <Card className="items-center py-12 bg-[#FFF9F2]">
              <Text className="text-4xl mb-3">📅</Text>
              <Text className="text-base font-bold text-[#2E241B]">
                No medication schedule for today
              </Text>
              <Text className="text-sm text-[#7D6E60] mt-1">
                Try changing the date or refreshing the data.
              </Text>
            </Card>
          ) : (
            scheduleGroups.map((group) => (
              <PeriodSection key={group.meal_time} group={group} onConfirm={handleConfirmPress} />
            ))
          )}
        </ScrollView>
      )}

      <ConfirmBottomSheet
        item={confirmItem}
        visible={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onSubmit={handleConfirmSubmit}
      />
      <DuplicateModal visible={showDuplicate} onClose={() => setShowDuplicate(false)} />
    </SafeAreaView>
  )
}
