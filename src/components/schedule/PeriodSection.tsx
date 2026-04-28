import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../ui/Card'
import { MedicationCard } from '../shared/MedicationCard'
import type { ScheduleGroup, ScheduleItem } from '../../stores/medicationStore'

interface PeriodSectionProps {
  group: ScheduleGroup
  onConfirm: (item: ScheduleItem) => void
  onBulkConfirm: (group: ScheduleGroup) => void
  bulkBusy: boolean
}

export function PeriodSection({ group, onConfirm, onBulkConfirm, bulkBusy }: PeriodSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pendingItems = group.items.filter((item) => item.status === 'pending' && !item.conflict_flag)
  const pendingCount = pendingItems.length

  return (
    <Card className="mb-4 bg-[#FFF9F2]">
      <TouchableOpacity
        onPress={() => setCollapsed((v) => !v)}
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
              <Text className="text-[11px] font-semibold text-[#A45A11]">{pendingCount} pending</Text>
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
              style={{ minHeight: 44, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E8CFB0', backgroundColor: bulkBusy ? '#F6EBDD' : '#FFF3E5', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: bulkBusy ? 0.7 : 1 }}
            >
              <Ionicons name="checkmark-done" size={16} color="#8E4B14" />
              <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#8E4B14' }}>
                {bulkBusy ? 'Confirming...' : `Confirm all ${pendingCount} pending (${group.label_en})`}
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
