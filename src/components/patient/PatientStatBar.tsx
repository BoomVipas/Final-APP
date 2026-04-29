import React from 'react'
import { Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#2F2E2D' }}>{value}</Text>
      <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 16, color: '#7E8797' }}>{label}</Text>
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
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        padding: 8,
        shadowColor: '#C8B89A',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
        elevation: 5,
      }}
    >
      <LinearGradient
        colors={['#F1F1F1', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          flexDirection: 'row',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#EDE4D8',
          height: 80,
        }}
      >
        <StatBlock value={statType}       label="Type" />
        <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 12 }} />
        <StatBlock value={statDosePerDay} label="Dose/Day" />
        <View style={{ width: 1, backgroundColor: '#ECE9E3', marginVertical: 12 }} />
        <StatBlock value={statEndDate}    label="End Date" />
      </LinearGradient>
    </View>
  )
}
