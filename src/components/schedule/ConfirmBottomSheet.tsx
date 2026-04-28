import React, { useEffect, useState } from 'react'
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Button } from '../ui/Button'
import type { ScheduleItem } from '../../stores/medicationStore'
import { type AdminMethod, METHOD_LABELS } from './types'

interface ConfirmBottomSheetProps {
  item: ScheduleItem | null
  visible: boolean
  onClose: () => void
  onSubmit: (item: ScheduleItem, method: AdminMethod, notes: string) => Promise<void>
  onRefuseRequest: (item: ScheduleItem) => void
}

export function ConfirmBottomSheet({ item, visible, onClose, onSubmit, onRefuseRequest }: ConfirmBottomSheetProps) {
  const [selectedMethod, setSelectedMethod] = useState<AdminMethod>('normal')
  const [notes, setNotes]                   = useState('')
  const [submitting, setSubmitting]         = useState(false)

  useEffect(() => {
    if (visible) { setSelectedMethod('normal'); setNotes(''); setSubmitting(false) }
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
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">Confirm Dose</Text>
          <Text className="text-xl font-bold text-[#2E241B] mt-2">Confirm Medication</Text>
          {item ? <Text className="text-sm text-[#6F6254] mt-2">{item.medicine_name}  •  {item.patient_name}</Text> : null}

          <Text className="text-sm font-semibold text-[#5E5145] mt-5 mb-3">Administration Method</Text>
          <View className="flex-row mb-5">
            {(Object.keys(METHOD_LABELS) as AdminMethod[]).map((method, index) => {
              const isActive = selectedMethod === method
              return (
                <TouchableOpacity
                  key={method}
                  onPress={() => setSelectedMethod(method)}
                  className={`flex-1 min-h-[50px] rounded-[20px] border items-center justify-center ${isActive ? 'border-[#C96B1A] bg-[#FFF0DD]' : 'border-[#EADBCB] bg-[#FFFDF8]'}`}
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
          <Text className="text-[11px] text-[#97928B] text-right mt-1 mb-5">{notes.length}/300</Text>

          <Button title="Confirm" onPress={handleSubmit} variant="primary" loading={submitting} disabled={submitting} />
          <TouchableOpacity
            onPress={() => { if (!item || submitting) return; onRefuseRequest(item) }}
            disabled={submitting}
            className="min-h-[48px] items-center justify-center mt-3"
            hitSlop={8}
          >
            <Text className="text-sm font-semibold text-[#A3322A]">ปฏิเสธ / Refuse instead</Text>
          </TouchableOpacity>
          <Button title="Cancel" onPress={onClose} variant="ghost" className="mt-1" />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
