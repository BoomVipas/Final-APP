import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import DocumentIcon from '../../../icons/Document.svg'
import DispenseIcon from '../../../icons/Dispense.svg'

interface InternalTabProps {
  active: boolean
  label: string
  onPress: () => void
}

export function InternalTab({ active, label, onPress }: InternalTabProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 items-center justify-center pb-2.5 pt-2.5"
      style={active ? { borderBottomWidth: 2, borderBottomColor: '#EFA54F' } : { borderBottomWidth: 2, borderBottomColor: 'transparent' }}
    >
      <View className="flex-row items-center">
        {label === 'Patients' ? (
          <DocumentIcon width={20} height={20} color={active ? '#EFA54F' : '#2F2F2F'} />
        ) : (
          <DispenseIcon width={20} height={20} color={active ? '#EFA54F' : '#2F2F2F'} />
        )}
        <Text className="text-[14px] leading-[20px] font-medium ml-2" style={{ color: active ? '#EFA54F' : '#1F1F1F' }}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
