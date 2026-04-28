import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

export interface StatCardGradient {
  colors: [string, string]
  start: { x: number; y: number }
  end: { x: number; y: number }
}

interface StatCardProps {
  label: string
  value: number
  SvgIcon: React.FC<{ width?: number; height?: number; color?: string }>
  iconBg?: string
  iconColor?: string
  gradient: StatCardGradient
  onPress: () => void
}

export function StatCard({ label, value, SvgIcon, iconBg, iconColor, gradient, onPress }: StatCardProps) {
  return (
    <LinearGradient
      colors={gradient.colors}
      start={gradient.start}
      end={gradient.end}
      style={{ flex: 1, borderRadius: 14 }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={{ flex: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 }}
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-[15px] leading-[20px] font-medium text-[#3B3836] flex-1 pr-2">{label}</Text>
          <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: iconBg ?? '#EBEBEB' }}>
            <SvgIcon width={22} height={22} color={iconColor ?? '#505050'} />
          </View>
        </View>
        <View className="flex-row items-end justify-between mt-4">
          <Text className="text-[30px] font-bold text-[#1F1D1B]">{value}</Text>
          <Ionicons name="chevron-forward" size={18} color="#5A5654" />
        </View>
      </TouchableOpacity>
    </LinearGradient>
  )
}
