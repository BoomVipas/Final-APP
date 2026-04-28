/**
 * app/(tabs)/schedule.tsx
 * Ward-level medication schedule grouped by meal period with confirmation flow.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
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
import type { MedicationLogsRow } from '../../src/types/database'

function formatTimeBilingual(iso: string): { th: string; en: string } {
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return { th: `${hh}:${mm}`, en: `${hh}:${mm}` }
}

type AdminMethod = 'normal' | 'crushed' | 'feeding_tube'

const METHOD_LABELS: Record<AdminMethod, string> = {
  normal: 'Normal',
  crushed: 'Crushed',
  feeding_tube: 'Feeding tube',
}

type RefusalReason = 'patient_refused' | 'asleep' | 'vomiting' | 'npo' | 'other'

const REFUSAL_REASONS: { value: RefusalReason; label_th: string; label_en: string }[] = [
  { value: 'patient_refused', label_th: 'ผู้ป่วยปฏิเสธ',  label_en: 'Patient refused' },
  { value: 'asleep',          label_th: 'ผู้ป่วยหลับ',     label_en: 'Patient asleep' },
  { value: 'vomiting',        label_th: 'อาเจียน',        label_en: 'Vomiting' },
  { value: 'npo',             label_th: 'งดอาหารและยา',  label_en: 'NPO (no food or meds)' },
  { value: 'other',           label_th: 'อื่นๆ',           label_en: 'Other' },
]

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
  onRefuseRequest,
}: {
  item: ScheduleItem | null
  visible: boolean
  onClose: () => void
  onSubmit: (item: ScheduleItem, method: AdminMethod, notes: string) => Promise<void>
  onRefuseRequest: (item: ScheduleItem) => void
}) {
  const [selectedMethod, setSelectedMethod] = useState<AdminMethod>('normal')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible) {
      setSelectedMethod('normal')
      setNotes('')
      setSubmitting(false)
    }
  }, [visible, item?.prescription_id, item?.meal_time])

  const handleSubmit = async () => {
    if (!item) return
    setSubmitting(true)
    await onSubmit(item, selectedMethod, notes)
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
          <View className="flex-row mb-5">
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

          <Text className="text-sm font-semibold text-[#5E5145] mb-2">
            หมายเหตุ / Notes <Text className="text-xs text-[#97928B]">(optional)</Text>
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="เช่น ผู้ป่วยกลืนยาช้า / e.g. patient took meds slowly"
            placeholderTextColor="#B0A89E"
            multiline
            maxLength={300}
            className="bg-[#FFFDF8] border border-[#EADBCB] rounded-[16px] px-3 py-3 text-sm text-[#2E241B]"
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <Text className="text-[11px] text-[#97928B] text-right mt-1 mb-5">
            {notes.length}/300
          </Text>

          <Button
            title="Confirm"
            onPress={handleSubmit}
            variant="primary"
            loading={submitting}
            disabled={submitting}
          />
          <TouchableOpacity
            onPress={() => {
              if (!item || submitting) return
              onRefuseRequest(item)
            }}
            disabled={submitting}
            className="min-h-[48px] items-center justify-center mt-3"
            hitSlop={8}
          >
            <Text className="text-sm font-semibold text-[#A3322A]">
              ปฏิเสธ / Refuse instead
            </Text>
          </TouchableOpacity>
          <Button title="Cancel" onPress={onClose} variant="ghost" className="mt-1" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function RefuseReasonSheet({
  item,
  visible,
  submitting,
  onCancel,
  onSubmit,
}: {
  item: ScheduleItem | null
  visible: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (item: ScheduleItem, reason: RefusalReason, notes: string) => Promise<void>
}) {
  const [selectedReason, setSelectedReason] = useState<RefusalReason>('patient_refused')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (visible) {
      setSelectedReason('patient_refused')
      setNotes('')
    }
  }, [visible, item?.prescription_id, item?.meal_time])

  const handleSubmit = async () => {
    if (!item) return
    await onSubmit(item, selectedReason, notes)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 bg-black/40" onPress={onCancel}>
        <View className="flex-1" />
        <Pressable
          onPress={() => {}}
          className="bg-[#FFF5E8] rounded-t-[32px] px-5 pt-5 pb-7 border-t border-[#EFE4D5]"
        >
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#A3322A]">
            ปฏิเสธยา / Refuse Dose
          </Text>
          <Text className="text-xl font-bold text-[#2E2C2A] mt-2">บันทึกการปฏิเสธ</Text>
          {item ? (
            <Text className="text-sm text-[#6F6254] mt-1.5">
              {item.medicine_name}  •  {item.patient_name}
            </Text>
          ) : null}

          <Text className="text-sm font-semibold text-[#5E5145] mt-5 mb-3">
            เหตุผล / Reason
          </Text>
          <View className="mb-4">
            {REFUSAL_REASONS.map((reason) => {
              const isActive = selectedReason === reason.value
              return (
                <TouchableOpacity
                  key={reason.value}
                  onPress={() => setSelectedReason(reason.value)}
                  className={`min-h-[52px] rounded-[16px] border px-4 mb-2 flex-row items-center justify-between ${
                    isActive
                      ? 'border-[#C96B1A] bg-[#FFF0DD]'
                      : 'border-[#EADBCB] bg-[#FFFDF8]'
                  }`}
                >
                  <View className="flex-1 pr-2">
                    <Text className={`text-sm font-semibold ${isActive ? 'text-[#8E4B14]' : 'text-[#2E241B]'}`}>
                      {reason.label_th}
                    </Text>
                    <Text className={`text-xs ${isActive ? 'text-[#A45A11]' : 'text-[#97928B]'} mt-0.5`}>
                      {reason.label_en}
                    </Text>
                  </View>
                  <Ionicons
                    name={isActive ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isActive ? '#C96B1A' : '#B0A89E'}
                  />
                </TouchableOpacity>
              )
            })}
          </View>

          <Text className="text-sm font-semibold text-[#5E5145] mb-2">
            หมายเหตุ / Notes <Text className="text-xs text-[#97928B]">(optional)</Text>
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="รายละเอียดเพิ่มเติม / additional details"
            placeholderTextColor="#B0A89E"
            multiline
            maxLength={300}
            className="bg-[#FFFDF8] border border-[#EADBCB] rounded-[16px] px-3 py-3 text-sm text-[#2E241B]"
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
          <Text className="text-[11px] text-[#97928B] text-right mt-1 mb-5">
            {notes.length}/300
          </Text>

          <Button
            title="บันทึกการปฏิเสธ / Save Refusal"
            onPress={handleSubmit}
            variant="primary"
            loading={submitting}
            disabled={submitting}
          />
          <Button title="Cancel" onPress={onCancel} variant="ghost" className="mt-2" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function DuplicateConfirmSheet({
  visible,
  item,
  conflictingLog,
  submitting,
  onCancel,
  onForce,
}: {
  visible: boolean
  item: ScheduleItem | null
  conflictingLog: MedicationLogsRow | null
  submitting: boolean
  onCancel: () => void
  onForce: () => void
}) {
  const lastLogged = conflictingLog ? formatTimeBilingual(conflictingLog.administered_at) : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 bg-black/40" onPress={onCancel}>
        <View className="flex-1" />
        <Pressable
          onPress={() => {}}
          className="bg-[#FFF5E8] rounded-t-[32px] px-5 pt-5 pb-7 border-t border-[#EFE4D5]"
        >
          <View className="items-center mb-3">
            <View className="w-14 h-14 rounded-full bg-[#FFE6CE] items-center justify-center">
              <Ionicons name="warning" size={30} color="#F2A24B" />
            </View>
          </View>

          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#F2A24B] text-center">
            แจ้งเตือนยาซ้ำ / Duplicate Dose
          </Text>
          <Text className="text-xl font-bold text-[#2E2C2A] text-center mt-2">
            ยานี้ถูกบันทึกไปแล้ว
          </Text>
          <Text className="text-sm font-semibold text-[#2E2C2A] text-center">
            This medication has already been logged
          </Text>

          {item ? (
            <View className="bg-white/60 border border-[#EFE4D5] rounded-[20px] p-4 mt-4">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B]">
                ผู้ป่วย / Patient
              </Text>
              <Text className="text-base font-bold text-[#2E2C2A] mt-1">
                {item.patient_name}
              </Text>
              {item.room_number ? (
                <Text className="text-xs text-[#97928B] mt-0.5">
                  ห้อง / Room {item.room_number}
                </Text>
              ) : null}

              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B] mt-3">
                ยา / Medication
              </Text>
              <Text className="text-base font-bold text-[#2E2C2A] mt-1">
                {item.medicine_name}
                {item.medicine_strength ? ` ${item.medicine_strength}` : ''}
              </Text>

              {lastLogged ? (
                <>
                  <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B] mt-3">
                    บันทึกล่าสุด / Last logged
                  </Text>
                  <Text className="text-base font-bold text-[#F2A24B] mt-1">
                    {lastLogged.th} น. / {lastLogged.en}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <Text className="text-xs text-[#97928B] text-center mt-4 mb-4">
            ยืนยันอีกครั้งเฉพาะกรณีที่จำเป็นเท่านั้น{'\n'}
            Only confirm again if you are sure this is a separate dose.
          </Text>

          <Button
            title="ยกเลิก / Cancel"
            onPress={onCancel}
            variant="secondary"
            disabled={submitting}
          />
          <Button
            title="บันทึกอยู่ดี / Log anyway"
            onPress={onForce}
            variant="primary"
            loading={submitting}
            disabled={submitting}
            className="mt-2"
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function PeriodSection({
  group,
  onConfirm,
  onBulkConfirm,
  bulkBusy,
}: {
  group: ScheduleGroup
  onConfirm: (item: ScheduleItem) => void
  onBulkConfirm: (group: ScheduleGroup) => void
  bulkBusy: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)
  const pendingItems = group.items.filter(
    (item) => item.status === 'pending' && !item.conflict_flag,
  )
  const pendingCount = pendingItems.length

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
          {pendingCount > 1 ? (
            <TouchableOpacity
              onPress={() => onBulkConfirm(group)}
              disabled={bulkBusy}
              activeOpacity={0.85}
              style={{
                minHeight: 44,
                marginBottom: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E8CFB0',
                backgroundColor: bulkBusy ? '#F6EBDD' : '#FFF3E5',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                opacity: bulkBusy ? 0.7 : 1,
              }}
            >
              <Ionicons name="checkmark-done" size={16} color="#8E4B14" />
              <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#8E4B14' }}>
                {bulkBusy
                  ? 'Confirming...'
                  : `Confirm all ${pendingCount} pending (${group.label_en})`}
              </Text>
            </TouchableOpacity>
          ) : null}

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
  const { scheduleGroups, fetchSchedule, confirmDose, refuseDose, checkDuplicate, subscribeToRealtime } = useMedicationStore()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [confirmItem, setConfirmItem] = useState<ScheduleItem | null>(null)
  const [duplicateItem, setDuplicateItem] = useState<ScheduleItem | null>(null)
  const [duplicateLog, setDuplicateLog] = useState<MedicationLogsRow | null>(null)
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false)
  const [duplicatePending, setDuplicatePending] = useState<{
    method: AdminMethod
    notes: string
  } | null>(null)
  const [refuseItem, setRefuseItem] = useState<ScheduleItem | null>(null)
  const [refuseSubmitting, setRefuseSubmitting] = useState(false)
  const [bulkConfirmingMealTime, setBulkConfirmingMealTime] = useState<string | null>(null)
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
    setConfirmItem(item)
  }

  const handleConfirmSubmit = async (item: ScheduleItem, method: AdminMethod, notes: string) => {
    if (!user) return

    const dup = await checkDuplicate(item)
    if (dup.isDuplicate) {
      setConfirmItem(null)
      setDuplicateItem(item)
      setDuplicateLog(dup.conflictingLog ?? null)
      setDuplicatePending({ method, notes })
      return
    }

    try {
      await confirmDose(item, user.id, { method, notes })
      setConfirmItem(null)
      await loadSchedule()
    } catch {
      setConfirmItem(null)
    }
  }

  const handleBulkConfirm = (group: ScheduleGroup) => {
    if (!user) return
    const pending = group.items.filter(
      (item) => item.status === 'pending' && !item.conflict_flag,
    )
    if (pending.length === 0) return

    Alert.alert(
      `Confirm ${pending.length} pending`,
      `Mark all ${pending.length} pending ${group.label_en.toLowerCase()} doses as Normal? Items with duplicate-dose conflicts will be skipped for manual review.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm all',
          onPress: async () => {
            setBulkConfirmingMealTime(group.meal_time)
            let confirmed = 0
            let duplicateSkipped = 0
            let failed = 0
            for (const item of pending) {
              try {
                await confirmDose(item, user.id, { method: 'normal' })
                confirmed += 1
              } catch (err) {
                const code = (err as { code?: string }).code
                if (code === 'DUPLICATE_DOSE') duplicateSkipped += 1
                else failed += 1
              }
            }
            setBulkConfirmingMealTime(null)
            await loadSchedule()

            const summaryLines = [`Confirmed: ${confirmed}`]
            if (duplicateSkipped > 0) summaryLines.push(`Duplicate-skipped: ${duplicateSkipped}`)
            if (failed > 0) summaryLines.push(`Failed: ${failed}`)
            Alert.alert('Bulk confirm complete', summaryLines.join('\n'))
          },
        },
      ],
    )
  }

  const handleRefuseRequest = (item: ScheduleItem) => {
    setConfirmItem(null)
    setRefuseItem(item)
  }

  const closeRefuseSheet = () => {
    if (refuseSubmitting) return
    setRefuseItem(null)
  }

  const handleRefuseSubmit = async (item: ScheduleItem, reason: RefusalReason, notes: string) => {
    if (!user) return
    setRefuseSubmitting(true)
    try {
      await refuseDose(item, user.id, reason, notes)
      setRefuseItem(null)
      await loadSchedule()
    } finally {
      setRefuseSubmitting(false)
    }
  }

  const closeDuplicateSheet = () => {
    setDuplicateItem(null)
    setDuplicateLog(null)
    setDuplicatePending(null)
  }

  const handleForceConfirm = async () => {
    if (!user || !duplicateItem) return
    setDuplicateSubmitting(true)
    try {
      await confirmDose(duplicateItem, user.id, {
        force: true,
        method: duplicatePending?.method ?? 'normal',
        notes: duplicatePending?.notes ?? null,
      })
      closeDuplicateSheet()
      await loadSchedule()
    } finally {
      setDuplicateSubmitting(false)
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
              <PeriodSection
                key={group.meal_time}
                group={group}
                onConfirm={handleConfirmPress}
                onBulkConfirm={handleBulkConfirm}
                bulkBusy={bulkConfirmingMealTime === group.meal_time}
              />
            ))
          )}
        </ScrollView>
      )}

      <ConfirmBottomSheet
        item={confirmItem}
        visible={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onSubmit={handleConfirmSubmit}
        onRefuseRequest={handleRefuseRequest}
      />
      <RefuseReasonSheet
        visible={!!refuseItem}
        item={refuseItem}
        submitting={refuseSubmitting}
        onCancel={closeRefuseSheet}
        onSubmit={handleRefuseSubmit}
      />
      <DuplicateConfirmSheet
        visible={!!duplicateItem}
        item={duplicateItem}
        conflictingLog={duplicateLog}
        submitting={duplicateSubmitting}
        onCancel={closeDuplicateSheet}
        onForce={handleForceConfirm}
      />
    </SafeAreaView>
  )
}
