import React from 'react'
import { ImageBackground, Text, View } from 'react-native'
import FrameIcon from '../../../icons/Frame.png'

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#2F2E2D' }}>{value}</Text>
      <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 16, color: '#7E8797' }}>{label}</Text>
    </View>
  )
}

interface PatientStatBarProps {
  statType: number
  statDosePerDay: number
  statEndDate: number
}

export function PatientStatBar({ statType, statDosePerDay, statEndDate }: PatientStatBarProps) {
  return (
    <ImageBackground
      source={FrameIcon}
      style={{
        marginTop: -74,
        marginHorizontal: 50,
        height: 116,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        shadowColor: '#D7CCBB',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 4,
      }}
      imageStyle={{ borderRadius: 28, resizeMode: 'stretch' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'stretch', flex: 1 }}>
        <StatBlock value={statType}       label="Type" />
        <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
        <StatBlock value={statDosePerDay} label="Dose/Day" />
        <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 18 }} />
        <StatBlock value={statEndDate}    label="End Date" />
      </View>
    </ImageBackground>
  )
}
