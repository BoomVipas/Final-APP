import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MedicineIcon from '../../../icons/Medicine.svg'
import { type DispenseCardData, CARD_SHADOW } from './types'

interface DispenseRowProps {
  card: DispenseCardData
  selected: boolean
  onToggle: () => void
}

export function DispenseRow({ card, selected, onToggle }: DispenseRowProps) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.9}
      className="bg-white rounded-[20px] mx-4 mb-3 px-4 py-4 flex-row items-center"
      style={CARD_SHADOW}
    >
      <View
        className="w-8 h-8 rounded-full border-2 mr-4 items-center justify-center"
        style={{ borderColor: selected ? '#F1A44F' : '#DDDEDF' }}
      >
        {selected ? <View className="w-4 h-4 rounded-full bg-[#F1A44F]" /> : null}
      </View>

      <View className="flex-1">
        <Text className="text-[15px] leading-[21px] font-semibold text-[#373737]" numberOfLines={1}>
          {card.name}
        </Text>
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="cube-outline" size={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">Room {card.room}</Text>
        </View>
      </View>

      <View className="flex-row items-center ml-3">
        <MedicineIcon width={16} height={16} color="#F1A44F" />
        <Text className="text-[14px] leading-[20px] font-semibold text-[#F1A44F] ml-1.5">
          {card.tablets} tablets
        </Text>
      </View>
    </TouchableOpacity>
  )
}
