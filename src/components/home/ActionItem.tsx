import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

interface ActionItemProps {
  SvgIcon: React.FC<{ width?: number; height?: number }>
  label: string
  onPress: () => void
}

export function ActionItem({ SvgIcon, label, onPress }: ActionItemProps) {
  const lines = label.split('\n')
  return (
    <TouchableOpacity onPress={onPress} className="flex-1 items-center px-1">
      <View className="w-[62px] h-[62px] rounded-[20px] bg-[#FFF5E8] items-center justify-center mb-2.5">
        <SvgIcon width={42} height={42} />
      </View>
      {lines.map((line, i) => (
        <Text key={i} className="text-[11px] leading-[15px] font-semibold text-[#2E2C2A] text-center">
          {line}
        </Text>
      ))}
    </TouchableOpacity>
  )
}
