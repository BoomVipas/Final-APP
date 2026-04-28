/**
 * app/(tabs)/schedule.tsx
 * Medication schedule screen — data + state only.
 *
 * UI components live in src/components/schedule/:
 *   types.ts                  → AdminMethod, RefusalReason, constants
 *   ConfirmBottomSheet.tsx    → dose confirmation sheet
 *   RefuseReasonSheet.tsx     → refusal reason picker sheet
 *   DuplicateConfirmSheet.tsx → duplicate dose warning sheet
 *   PeriodSection.tsx         → one meal-period group (Morning/Noon/Evening/Night)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleGroup, type ScheduleItem } from '../../src/stores/medicationStore'
import { Card } from '../../src/components/ui/Card'
import type { MedicationLogsRow } from '../../src/types/database'

import { ConfirmBottomSheet }    from '../../src/components/schedule/ConfirmBottomSheet'
import { RefuseReasonSheet }     from '../../src/components/schedule/RefuseReasonSheet'
import { DuplicateConfirmSheet } from '../../src/components/schedule/DuplicateConfirmSheet'
import { PeriodSection }         from '../../src/components/schedule/PeriodSection'
import { type AdminMethod, type RefusalReason } from '../../src/components/schedule/types'

function formatDateEnglish(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export default function ScheduleScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { scheduleGroups, fetchSchedule, confirmDose, refuseDose, checkDuplicate, subscribeToRealtime } = useMedicationStore()

  const [currentDate, setCurrentDate]         = useState(new Date())
  const [refreshing, setRefreshing]           = useState(false)
  const [confirmItem, setConfirmItem]         = useState<ScheduleItem | null>(null)
  const [duplicateItem, setDuplicateItem]     = useState<ScheduleItem | null>(null)
  const [duplicateLog, setDuplicateLog]       = useState<MedicationLogsRow | null>(null)
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false)
  const [duplicatePending, setDuplicatePending] = useState<{ method: AdminMethod; notes: string } | null>(null)
  const [refuseItem, setRefuseItem]           = useState<ScheduleItem | null>(null)
  const [refuseSubmitting, setRefuseSubmitting] = useState(false)
  const [bulkConfirmingMealTime, setBulkConfirmingMealTime] = useState<string | null>(null)
  const [loadingDate, setLoadingDate]         = useState(false)

  const wardId  = user?.ward_id ?? ''
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
    if (wardId) { unsubRef.current?.(); unsubRef.current = subscribeToRealtime(wardId, dateStr) }
    return () => { unsubRef.current?.() }
  }, [dateStr, loadSchedule, subscribeToRealtime, wardId])

  const onRefresh = async () => { setRefreshing(true); await loadSchedule(); setRefreshing(false) }

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
    const pending = group.items.filter((item) => item.status === 'pending' && !item.conflict_flag)
    if (pending.length === 0) return

    Alert.alert(`Confirm ${pending.length} pending`, `Mark all ${pending.length} pending ${group.label_en.toLowerCase()} doses as Normal? Items with duplicate-dose conflicts will be skipped for manual review.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm all',
        onPress: async () => {
          setBulkConfirmingMealTime(group.meal_time)
          let confirmed = 0; let duplicateSkipped = 0; let failed = 0
          for (const item of pending) {
            try { await confirmDose(item, user.id, { method: 'normal' }); confirmed++ }
            catch (err) { if ((err as { code?: string }).code === 'DUPLICATE_DOSE') duplicateSkipped++; else failed++ }
          }
          setBulkConfirmingMealTime(null)
          await loadSchedule()
          const lines = [`Confirmed: ${confirmed}`]
          if (duplicateSkipped > 0) lines.push(`Duplicate-skipped: ${duplicateSkipped}`)
          if (failed > 0) lines.push(`Failed: ${failed}`)
          Alert.alert('Bulk confirm complete', lines.join('\n'))
        },
      },
    ])
  }

  const handleRefuseSubmit = async (item: ScheduleItem, reason: RefusalReason, notes: string) => {
    if (!user) return
    setRefuseSubmitting(true)
    try { await refuseDose(item, user.id, reason, notes); setRefuseItem(null); await loadSchedule() }
    finally { setRefuseSubmitting(false) }
  }

  const closeDuplicateSheet = () => { setDuplicateItem(null); setDuplicateLog(null); setDuplicatePending(null) }

  const handleForceConfirm = async () => {
    if (!user || !duplicateItem) return
    setDuplicateSubmitting(true)
    try {
      await confirmDose(duplicateItem, user.id, { force: true, method: duplicatePending?.method ?? 'normal', notes: duplicatePending?.notes ?? null })
      closeDuplicateSheet()
      await loadSchedule()
    } finally { setDuplicateSubmitting(false) }
  }

  const handleBack = () => { if (router.canGoBack()) { router.back(); return }; router.replace('/(tabs)') }

  return (
    <SafeAreaView className="flex-1 bg-[#F6EFE6]">
      {/* Back button */}
      <View className="px-4 pt-3">
        <TouchableOpacity onPress={handleBack} activeOpacity={0.85} className="w-12 h-12 rounded-full bg-[#FFF9F2] border border-[#EADBCB] items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#8E4B14" />
        </TouchableOpacity>
      </View>

      {/* Title card */}
      <View className="px-4 pt-3 pb-2">
        <Card className="bg-[#FFF3E5] border-[#E8CFB0]">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">Medication Schedule</Text>
          <Text className="text-[28px] leading-[34px] font-bold text-[#2E241B] mt-2">Schedule</Text>
          <Text className="text-sm text-[#6F6254] mt-2">Confirm medication in real time with duplicate-dose protection before saving.</Text>
        </Card>
      </View>

      {/* Date navigator */}
      <View className="px-4 pb-3">
        <Card className="bg-[#FFF9F2]">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => setCurrentDate((d) => addDays(d, -1))} className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#F6EBDD]">
              <Ionicons name="chevron-back" size={22} color="#8E4B14" />
            </TouchableOpacity>
            <View className="flex-1 px-4">
              <Text className="text-center text-base font-bold text-[#2E241B]">{formatDateEnglish(currentDate)}</Text>
              <Text className="text-center text-xs text-[#7D6E60] mt-1">{scheduleGroups.length} time groups</Text>
            </View>
            <TouchableOpacity onPress={() => setCurrentDate((d) => addDays(d, 1))} className="min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-[#F6EBDD]">
              <Ionicons name="chevron-forward" size={22} color="#8E4B14" />
            </TouchableOpacity>
          </View>
        </Card>
      </View>

      {/* Schedule list */}
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
              <Text className="text-base font-bold text-[#2E241B]">No medication schedule for today</Text>
              <Text className="text-sm text-[#7D6E60] mt-1">Try changing the date or refreshing the data.</Text>
            </Card>
          ) : (
            scheduleGroups.map((group) => (
              <PeriodSection
                key={group.meal_time}
                group={group}
                onConfirm={(item) => setConfirmItem(item)}
                onBulkConfirm={handleBulkConfirm}
                bulkBusy={bulkConfirmingMealTime === group.meal_time}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Bottom sheets */}
      <ConfirmBottomSheet
        item={confirmItem}
        visible={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        onSubmit={handleConfirmSubmit}
        onRefuseRequest={(item) => { setConfirmItem(null); setRefuseItem(item) }}
      />
      <RefuseReasonSheet
        visible={!!refuseItem}
        item={refuseItem}
        submitting={refuseSubmitting}
        onCancel={() => { if (!refuseSubmitting) setRefuseItem(null) }}
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
