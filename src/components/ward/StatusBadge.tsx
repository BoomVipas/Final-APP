import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type PatientBadge } from './types'

export function StatusBadge({ badge }: { badge: PatientBadge }) {
  if (badge === 'urgent') {
    return (
      <View className="flex-row items-center bg-[#FDECED] px-3 py-1 rounded-full mr-2 mb-1.5">
        <Ionicons name="alert-circle" size={12} color="#F26666" />
        <Text className="text-[12px] leading-[16px] font-medium text-[#F26666] ml-1.5">Urgent</Text>
      </View>
    )
  }
  if (badge === 'dispensed') {
    return (
      <View className="flex-row items-center bg-[#DDFBF3] px-3 py-1 rounded-full mr-2 mb-1.5">
        <Ionicons name="checkmark-circle" size={12} color="#24B88F" />
        <Text className="text-[12px] leading-[16px] font-medium text-[#24B88F] ml-1.5">Dispensed</Text>
      </View>
    )
  }
  return (
    <View className="flex-row items-center bg-[#FEF1E6] px-3 py-1 rounded-full mr-2 mb-1.5">
      <Ionicons name="warning" size={12} color="#F2A14C" />
      <Text className="text-[12px] leading-[16px] font-medium text-[#F2A14C] ml-1.5">Low Medication</Text>
    </View>
  )
}
