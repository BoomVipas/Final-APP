import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import TickIcon from '../../../icons/Tick.svg'

interface TimeChipProps {
  label: string
  active: boolean
  completed?: boolean
  onPress: () => void
}

export function TimeChip({ label, active, completed, onPress }: TimeChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginRight: 10, overflow: 'hidden' }}
    >
      {completed ? (
        <LinearGradient
          colors={['#DDFBF3', '#F4FFFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, borderWidth: 1, borderColor: '#BDEFE3' }}
        />
      ) : (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: active ? '#F6AB52' : '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: active ? '#F6AB52' : '#E4E2DE' }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {completed ? <TickIcon width={16} height={16} style={{ marginRight: 5 }} /> : null}
        <Text style={{ fontSize: 14, color: active ? '#2A2A2A' : completed ? '#18B88E' : '#313131' }}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
