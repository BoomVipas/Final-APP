import React from 'react'
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../ui/Button'
import type { ScheduleItem } from '../../stores/medicationStore'
import type { MedicationLogsRow } from '../../types/database'

function formatTimeBilingual(iso: string): { th: string; en: string } {
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return { th: `${hh}:${mm}`, en: `${hh}:${mm}` }
}

interface DuplicateConfirmSheetProps {
  visible: boolean
  item: ScheduleItem | null
  conflictingLog: MedicationLogsRow | null
  submitting: boolean
  onCancel: () => void
  onForce: () => void
}

export function DuplicateConfirmSheet({ visible, item, conflictingLog, submitting, onCancel, onForce }: DuplicateConfirmSheetProps) {
  const lastLogged = conflictingLog ? formatTimeBilingual(conflictingLog.administered_at) : null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 bg-black/40" onPress={onCancel}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF5E8] rounded-t-[32px] px-5 pt-5 pb-7 border-t border-[#EFE4D5]">
          <View className="items-center mb-3">
            <View className="w-14 h-14 rounded-full bg-[#FFE6CE] items-center justify-center">
              <Ionicons name="warning" size={30} color="#F2A24B" />
            </View>
          </View>

          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#F2A24B] text-center">แจ้งเตือนยาซ้ำ / Duplicate Dose</Text>
          <Text className="text-xl font-bold text-[#2E2C2A] text-center mt-2">ยานี้ถูกบันทึกไปแล้ว</Text>
          <Text className="text-sm font-semibold text-[#2E2C2A] text-center">This medication has already been logged</Text>

          {item ? (
            <View className="bg-white/60 border border-[#EFE4D5] rounded-[20px] p-4 mt-4">
              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B]">ผู้ป่วย / Patient</Text>
              <Text className="text-base font-bold text-[#2E2C2A] mt-1">{item.patient_name}</Text>
              {item.room_number ? <Text className="text-xs text-[#97928B] mt-0.5">ห้อง / Room {item.room_number}</Text> : null}

              <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B] mt-3">ยา / Medication</Text>
              <Text className="text-base font-bold text-[#2E2C2A] mt-1">
                {item.medicine_name}{item.medicine_strength ? ` ${item.medicine_strength}` : ''}
              </Text>

              {lastLogged ? (
                <>
                  <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-[#97928B] mt-3">บันทึกล่าสุด / Last logged</Text>
                  <Text className="text-base font-bold text-[#F2A24B] mt-1">{lastLogged.th} น. / {lastLogged.en}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          <Text className="text-xs text-[#97928B] text-center mt-4 mb-4">
            ยืนยันอีกครั้งเฉพาะกรณีที่จำเป็นเท่านั้น{'\n'}
            Only confirm again if you are sure this is a separate dose.
          </Text>

          <Button title="ยกเลิก / Cancel" onPress={onCancel} variant="secondary" disabled={submitting} />
          <Button title="บันทึกอยู่ดี / Log anyway" onPress={onForce} variant="primary" loading={submitting} disabled={submitting} className="mt-2" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
