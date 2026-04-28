import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PatientAvatar } from '../shared/PatientAvatar'
import UnionIcon from '../../../icons/Ward.svg'
import HealthIcon from '../../../icons/Health.svg'
import { StatusBadge } from './StatusBadge'
import { type WardPatientCard, CARD_SHADOW } from './types'

interface WardPatientRowProps {
  card: WardPatientCard
  onPress: () => void
  onMore: () => void
}

export function WardPatientRow({ card, onPress, onMore }: WardPatientRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-[20px] mx-4 mb-3 px-4 py-4 flex-row items-start"
      style={CARD_SHADOW}
    >
      <PatientAvatar name={card.name} size={48} className="mr-3 mt-0.5" />

      <View className="flex-1 pr-2">
        <Text className="text-[15px] leading-[21px] font-semibold text-[#373737]" numberOfLines={1}>
          {card.name}
        </Text>
        <View className="flex-row items-center mt-1.5">
          <UnionIcon width={14} height={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">
            Room {card.room}{card.age !== null ? ` • Age ${card.age}` : ''}
          </Text>
        </View>
        <View className="flex-row items-center mt-1.5">
          <HealthIcon width={14} height={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">{card.tablets} tablets</Text>
        </View>
        {card.badges.length > 0 ? (
          <View className="flex-row flex-wrap mt-2">
            {card.badges.map((badge) => <StatusBadge key={badge} badge={badge} />)}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${card.name}`}
        onPress={onMore}
        hitSlop={10}
        className="w-12 h-12 items-center justify-center -mt-1 -mr-1"
      >
        <Ionicons name="ellipsis-vertical" size={18} color="#4A4A4A" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}
