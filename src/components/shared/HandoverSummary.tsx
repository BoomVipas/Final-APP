/**
 * src/components/shared/HandoverSummary.tsx
 * Renders handover summary JSON into grouped sections.
 */

import React from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ShiftHandoversRow } from '../../types/database'

interface HandoverSummaryProps {
  handover: ShiftHandoversRow
  deferredKeys?: Set<string>
  onToggleDefer?: (key: string) => void
}

export function pendingItemKey(item: { patient_name?: string; medication_name?: string; meal_period?: string | null }, idx: number): string {
  return `${item.patient_name ?? '?'}::${item.medication_name ?? '?'}::${item.meal_period ?? ''}::${idx}`
}

interface PendingMedItem {
  patient_name?: string
  medication_name?: string
  room_bed?: string | null
  meal_period?: string | null
}

interface ChangeItem {
  patient_name?: string
  medication_name?: string
  change_type?: string
  previous_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
}

interface PRNItem {
  patient_name?: string
  medication_name?: string
  administered_at?: string
  notes?: string | null
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-bold text-[#5E5145] mb-2">{title}</Text>
      {children}
    </View>
  )
}

function PendingMedRow({
  item,
  deferred,
  onToggleDefer,
}: {
  item: PendingMedItem
  deferred?: boolean
  onToggleDefer?: () => void
}) {
  const showDeferControl = typeof onToggleDefer === 'function'
  return (
    <View
      className={`rounded-[22px] p-3 mb-2 border ${
        deferred ? 'bg-[#FFF7E7] border-[#EBCF99]' : 'bg-[#FFF3F1] border-[#F2C7C3]'
      }`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className={`text-sm font-semibold ${deferred ? 'text-[#8E4B14]' : 'text-[#A3322A]'}`}>
            {item.patient_name ?? 'ไม่ทราบชื่อ'}
            {item.room_bed ? `  •  ห้อง ${item.room_bed}` : ''}
          </Text>
          <Text className={`text-xs mt-1 ${deferred ? 'text-[#A45A11]' : 'text-[#7A3A35]'}`}>
            {item.medication_name ?? '-'}
            {item.meal_period ? `  •  ${item.meal_period}` : ''}
          </Text>
        </View>
        {showDeferControl ? (
          <TouchableOpacity
            onPress={onToggleDefer}
            activeOpacity={0.85}
            className={`flex-row items-center rounded-full px-2.5 py-1.5 border ${
              deferred ? 'bg-[#FFE6CC] border-[#C96B1A]' : 'bg-white border-[#D6C5B2]'
            }`}
            style={{ minHeight: 28 }}
          >
            <Ionicons
              name={deferred ? 'time' : 'time-outline'}
              size={13}
              color={deferred ? '#8E4B14' : '#7D6E60'}
            />
            <Text
              className={`text-[10px] font-semibold ml-1 ${deferred ? 'text-[#8E4B14]' : 'text-[#7D6E60]'}`}
            >
              {deferred ? 'Deferred' : 'Defer'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {deferred ? (
        <Text className="text-[11px] text-[#A45A11] mt-2 italic">
          ⏭ ส่งต่อให้กะถัดไป / Will carry over to next shift
        </Text>
      ) : null}
    </View>
  )
}

function ChangeRow({ item }: { item: ChangeItem }) {
  return (
    <View className="bg-[#FFF7E7] border border-[#EBCF99] rounded-[22px] p-3 mb-2">
      <Text className="text-sm font-semibold text-[#8E4B14]">
        {item.patient_name ?? 'ไม่ทราบชื่อ'}
      </Text>
      <Text className="text-xs text-[#A45A11] mt-1">
        {item.medication_name ?? '-'}  •  {item.change_type ?? '-'}
      </Text>
      {item.previous_value && item.new_value && (
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1 bg-[#FBE4E1] rounded-2xl p-2">
            <Text className="text-xs text-[#A3322A] font-medium">เดิม</Text>
            <Text className="text-xs text-[#7A3A35]">
              {JSON.stringify(item.previous_value, null, 0).slice(0, 80)}
            </Text>
          </View>
          <View className="flex-1 bg-[#EAF4EB] rounded-2xl p-2">
            <Text className="text-xs text-[#2F6B55] font-medium">ใหม่</Text>
            <Text className="text-xs text-[#396E59]">
              {JSON.stringify(item.new_value, null, 0).slice(0, 80)}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

function PRNRow({ item }: { item: PRNItem }) {
  const time = item.administered_at
    ? new Date(item.administered_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : '-'
  return (
    <View className="bg-[#ECF4FD] border border-[#CFE0F5] rounded-[22px] p-3 mb-2">
      <Text className="text-sm font-semibold text-[#295B97]">{item.patient_name ?? 'ไม่ทราบชื่อ'}</Text>
      <Text className="text-xs text-[#3B6699] mt-1">
        {item.medication_name ?? '-'}  •  {time}
      </Text>
      {item.notes && <Text className="text-xs text-[#5679A5] mt-1 italic">{item.notes}</Text>}
    </View>
  )
}

export function HandoverSummary({ handover, deferredKeys, onToggleDefer }: HandoverSummaryProps) {
  const summary = handover.summary_json as Record<string, unknown>

  const pendingMeds = (summary?.pending_medications as PendingMedItem[] | undefined) ?? []
  const prescriptionChanges = (summary?.prescription_changes as ChangeItem[] | undefined) ?? []
  const prnMeds = (summary?.prn_medications as PRNItem[] | undefined) ?? []
  const alerts = (summary?.alerts as string[] | undefined) ?? []

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View className="bg-[#FFF3E5] border border-[#E8CFB0] rounded-[28px] p-4 mb-4">
        <Text className="text-base font-bold text-[#2E241B]">
          สรุปกะ: {new Date(handover.shift_start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          {' — '}
          {new Date(handover.shift_end).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text className="text-sm text-[#6F6254] mt-1">
          {new Date(handover.shift_start).toLocaleDateString('th-TH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {pendingMeds.length > 0 && (
        <Section title={`🔴 ยาที่ยังไม่ได้จ่าย (${pendingMeds.length} รายการ)`}>
          {pendingMeds.map((item, idx) => {
            const key = pendingItemKey(item, idx)
            return (
              <PendingMedRow
                key={key}
                item={item}
                deferred={deferredKeys?.has(key) ?? false}
                onToggleDefer={onToggleDefer ? () => onToggleDefer(key) : undefined}
              />
            )
          })}
        </Section>
      )}

      {pendingMeds.length === 0 && (
        <Section title="🔴 ยาที่ยังไม่ได้จ่าย">
          <Text className="text-sm text-[#2F6B55]">✅ จ่ายครบทุกรายการ</Text>
        </Section>
      )}

      {prescriptionChanges.length > 0 && (
        <Section title={`📋 ยาที่เปลี่ยนแปลง (${prescriptionChanges.length} รายการ)`}>
          {prescriptionChanges.map((item, idx) => (
            <ChangeRow key={idx} item={item} />
          ))}
        </Section>
      )}

      {prnMeds.length > 0 && (
        <Section title={`💊 ยา PRN ที่ให้ในกะนี้ (${prnMeds.length} รายการ)`}>
          {prnMeds.map((item, idx) => (
            <PRNRow key={idx} item={item} />
          ))}
        </Section>
      )}

      {alerts.length > 0 && (
        <Section title={`⚠️ แจ้งเตือน (${alerts.length} รายการ)`}>
          {alerts.map((alert, idx) => (
            <View key={idx} className="bg-[#FFF7E7] border border-[#EBCF99] rounded-[22px] p-3 mb-2">
              <Text className="text-xs text-[#8E4B14]">{alert}</Text>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  )
}
