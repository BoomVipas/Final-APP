import React from 'react'
import { Text, View } from 'react-native'

interface SummaryStatProps {
  value: number
  label: string
  borderRight?: boolean
}

export function SummaryStat({ value, label, borderRight }: SummaryStatProps) {
  return (
    <View className="flex-1 items-center justify-center py-4">
      <Text className="text-[28px] leading-[34px] font-semibold text-[#373737]">{value}</Text>
      <Text className="text-[12px] leading-[16px] text-[#7D8798] mt-1">{label}</Text>
      {borderRight ? <View className="absolute right-0 top-4 bottom-4 w-px bg-[#ECEAE6]" /> : null}
    </View>
  )
}
