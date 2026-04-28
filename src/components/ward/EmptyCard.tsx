import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CARD_SHADOW } from './types'

interface EmptyCardProps {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
}

export function EmptyCard({ icon, title, subtitle }: EmptyCardProps) {
  return (
    <View className="bg-white rounded-[28px] mx-5 px-6 py-10 items-center" style={CARD_SHADOW}>
      <View className="w-16 h-16 rounded-full bg-[#FFF5EA] items-center justify-center mb-4">
        <Ionicons name={icon} size={28} color="#EFA54F" />
      </View>
      <Text className="text-[20px] leading-[26px] font-semibold text-[#323232] text-center">{title}</Text>
      <Text className="text-[14px] leading-[20px] text-[#8891A1] text-center mt-2">{subtitle}</Text>
    </View>
  )
}
