import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type AlertCardData } from './types'

interface AlertCardProps {
  alert: AlertCardData
  onPress: () => void
  onMorePress: () => void
}

export function AlertCard({ alert, onPress, onMorePress }: AlertCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white border border-[#F0E6D8] rounded-[16px] px-4 pt-4 pb-4 mb-3"
      style={{ shadowColor: '#B09070', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}
    >
      <View className="flex-row items-start">
        <View className="w-[52px] h-[52px] rounded-[14px] bg-[#FFF3E4] items-center justify-center mr-3">
          <Text className="text-[26px]">💊</Text>
        </View>

        <View className="flex-1 pr-2">
          <Text className="text-[14px] font-bold text-[#282420]">{alert.patientName}</Text>
          <Text className="text-[12.5px] text-[#5A5450] mt-0.5">{alert.title}</Text>

          <View className="flex-row items-center mt-2">
            <Ionicons name="medkit-outline" size={12} color="#9B9590" />
            <Text className="text-[12px] text-[#837E7A] ml-1.5" numberOfLines={1}>{alert.medication}</Text>
          </View>

          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={12} color="#9B9590" />
            <Text className="text-[12px] text-[#837E7A] ml-1.5">{alert.detail}</Text>
          </View>

          <View className={`self-start mt-3 rounded-full px-3 py-1.5 ${alert.ctaTone === 'danger' ? 'bg-[#FFEEED]' : 'bg-[#FFF2E4]'}`}>
            <Text className={`text-[11px] font-medium ${alert.ctaTone === 'danger' ? 'text-[#FF5A52]' : 'text-[#E08830]'}`}>
              🔔 {alert.cta}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onMorePress} className="min-h-[32px] min-w-[24px] items-center justify-center">
          <Ionicons name="ellipsis-vertical" size={16} color="#4A4744" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}
