/**
 * src/components/shared/HandoverSummary.tsx
 * Renders handover summary JSON into grouped sections.
 */

import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import type { ShiftHandoversRow } from '../../types/database'

interface HandoverSummaryProps {
  handover: ShiftHandoversRow
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

function PendingMedRow({ item }: { item: PendingMedItem }) {
  return (
    <View className="bg-[#FFF3F1] border border-[#F2C7C3] rounded-[22px] p-3 mb-2">
      <Text className="text-sm font-semibold text-[#A3322A]">
        {item.patient_name ?? 'ไม่ทราบชื่อ'}
        {item.room_bed ? `  •  ห้อง ${item.room_bed}` : ''}
      </Text>
      <Text className="text-xs text-[#7A3A35] mt-1">
        {item.medication_name ?? '-'}
        {item.meal_period ? `  •  ${item.meal_period}` : ''}
      </Text>
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

export function HandoverSummary({ handover }: HandoverSummaryProps) {
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
          {pendingMeds.map((item, idx) => (
            <PendingMedRow key={idx} item={item} />
          ))}
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
