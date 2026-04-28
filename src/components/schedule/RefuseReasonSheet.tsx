import React, { useEffect, useState } from 'react'
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../ui/Button'
import type { ScheduleItem } from '../../stores/medicationStore'
import { type RefusalReason, REFUSAL_REASONS } from './types'

interface RefuseReasonSheetProps {
  item: ScheduleItem | null
  visible: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (item: ScheduleItem, reason: RefusalReason, notes: string) => Promise<void>
}

export function RefuseReasonSheet({ item, visible, submitting, onCancel, onSubmit }: RefuseReasonSheetProps) {
  const [selectedReason, setSelectedReason] = useState<RefusalReason>('patient_refused')
  const [notes, setNotes]                   = useState('')

  useEffect(() => {
    if (visible) { setSelectedReason('patient_refused'); setNotes('') }
  }, [visible, item?.prescription_id, item?.meal_time])

  const handleSubmit = async () => {
    if (!item) return
    await onSubmit(item, selectedReason, notes)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable className="flex-1 bg-black/40" onPress={onCancel}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF5E8] rounded-t-[32px] px-5 pt-5 pb-7 border-t border-[#EFE4D5]">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#A3322A]">ปฏิเสธยา / Refuse Dose</Text>
          <Text className="text-xl font-bold text-[#2E2C2A] mt-2">บันทึกการปฏิเสธ</Text>
          {item ? <Text className="text-sm text-[#6F6254] mt-1.5">{item.medicine_name}  •  {item.patient_name}</Text> : null}

          <Text className="text-sm font-semibold text-[#5E5145] mt-5 mb-3">เหตุผล / Reason</Text>
          <View className="mb-4">
            {REFUSAL_REASONS.map((reason) => {
              const isActive = selectedReason === reason.value
              return (
                <TouchableOpacity
                  key={reason.value}
                  onPress={() => setSelectedReason(reason.value)}
                  className={`min-h-[52px] rounded-[16px] border px-4 mb-2 flex-row items-center justify-between ${isActive ? 'border-[#C96B1A] bg-[#FFF0DD]' : 'border-[#EADBCB] bg-[#FFFDF8]'}`}
                >
                  <View className="flex-1 pr-2">
                    <Text className={`text-sm font-semibold ${isActive ? 'text-[#8E4B14]' : 'text-[#2E241B]'}`}>{reason.label_th}</Text>
                    <Text className={`text-xs ${isActive ? 'text-[#A45A11]' : 'text-[#97928B]'} mt-0.5`}>{reason.label_en}</Text>
                  </View>
                  <Ionicons name={isActive ? 'radio-button-on' : 'radio-button-off'} size={20} color={isActive ? '#C96B1A' : '#B0A89E'} />
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
          <Text className="text-[11px] text-[#97928B] text-right mt-1 mb-5">{notes.length}/300</Text>

          <Button title="บันทึกการปฏิเสธ / Save Refusal" onPress={handleSubmit} variant="primary" loading={submitting} disabled={submitting} />
          <Button title="Cancel" onPress={onCancel} variant="ghost" className="mt-2" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
