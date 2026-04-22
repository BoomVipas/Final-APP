/**
 * src/components/shared/MedicationCard.tsx
 * Card component for a single medication schedule item.
 */

import React from 'react'
import { Text, View } from 'react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { ScheduleItem } from '../../stores/medicationStore'

type BadgeStatus = React.ComponentProps<typeof Badge>['status']

interface MedicationCardProps {
  item: ScheduleItem
  showPatientName?: boolean
  onConfirm?: (item: ScheduleItem) => void
  onPress?: () => void
  testID?: string
}

function getStatusBadge(status: ScheduleItem['status']): { status: BadgeStatus; label: string } {
  switch (status) {
    case 'confirmed': return { status: 'confirmed', label: '✅ จ่ายแล้ว' }
    case 'refused':   return { status: 'refused',   label: '❌ ปฏิเสธ' }
    case 'skipped':   return { status: 'missed',    label: '⏭ ข้าม' }
    default:          return { status: 'pending',   label: '⏳ รอ' }
  }
}

export function MedicationCard({ item, showPatientName = false, onConfirm, onPress, testID }: MedicationCardProps) {
  const badge = getStatusBadge(item.status)
  const canConfirm = item.status === 'pending' && !item.conflict_flag && !!onConfirm

  return (
    <Card onPress={onPress} testID={testID} className="mb-3 bg-[#FFF9F2]">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-[#2E241B]" numberOfLines={1}>
            {item.medicine_name}
          </Text>
          {item.medicine_strength && (
            <Text className="text-xs text-[#7D6E60] mt-1">{item.medicine_strength}</Text>
          )}
        </View>
        <Badge status={badge.status} label={badge.label} />
      </View>

      {showPatientName && (
        <Text className="text-sm text-[#5E5145] mb-1.5">
          {item.patient_name}
          {item.room_number ? `  •  ห้อง ${item.room_number}` : ''}
        </Text>
      )}

      <Text className="text-sm text-[#5E5145] mb-1">
        {item.dose_quantity} เม็ด
        {item.dosage_form ? `  •  ${item.dosage_form}` : ''}
      </Text>

      {item.notes && (
        <View className="bg-[#F6EBDD] rounded-2xl px-3 py-2 mb-2">
          <Text className="text-xs text-[#8E4B14] italic">{item.notes}</Text>
        </View>
      )}

      {item.conflict_flag && (
        <View className="bg-[#FBE4E1] rounded-2xl p-3 mb-2">
          <Text className="text-xs font-semibold text-[#A3322A]">⚠️ ตรวจพบการจ่ายซ้ำ</Text>
        </View>
      )}

      {canConfirm && (
        <Button
          title="ยืนยันจ่ายยา"
          onPress={() => onConfirm(item)}
          variant="primary"
          compact
          className="mt-2 rounded-2xl px-4 py-2.5"
        />
      )}

      {item.conflict_flag && item.status === 'pending' && (
        <View className="bg-[#FBE4E1] rounded-2xl py-2.5 px-3 mt-1 items-center">
          <Text className="text-xs font-semibold text-[#A3322A]">🚫 บล็อกเนื่องจากซ้ำ</Text>
        </View>
      )}
    </Card>
  )
}
