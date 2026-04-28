import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import HealthIcon from '../../../icons/Health.svg'
import Profile2Icon from 'icons/Profile2Icon'

interface PatientHeaderProps {
  patientName: string
  roomNumber: string
  age: number | null
  heroMedicationCount: number
  onBack: () => void
  onActions: () => void
}

export function PatientHeader({ patientName, roomNumber, age, heroMedicationCount, onBack, onActions }: PatientHeaderProps) {
  return (
    <LinearGradient
      colors={['#F9E1BE', '#F5BC77', '#ECA44E']}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingBottom: 72, overflow: 'hidden' }}
    >
      <SafeAreaView edges={['top']}>
        {/* Decorative background circles */}
        <View style={{ position: 'absolute', top: -26, left: -54, width: 164, height: 164, borderRadius: 82, backgroundColor: '#FFF3DE', opacity: 0.3 }} accessible={false} />
        <View style={{ position: 'absolute', top: 8, right: -20, width: 176, height: 176, borderRadius: 88, backgroundColor: '#FFD9A8', opacity: 0.34 }} accessible={false} />
        <View style={{ position: 'absolute', right: 34, top: 22, width: 114, height: 114, borderRadius: 57, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' }} accessible={false} />

        <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
          {/* Title bar: ← back · "Patients Detail" · ⋯ actions */}
          <View style={{ position: 'relative', minHeight: 44, justifyContent: 'center' }}>
            <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={28} color="#2F2E2D" />
            </TouchableOpacity>

            <Text style={{ position: 'absolute', alignSelf: 'center', fontSize: 18, lineHeight: 24, fontWeight: '500', color: '#2F2E2D' }}>
              Patients Detail
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Patient actions for ${patientName}`}
              onPress={onActions}
              style={{ position: 'absolute', right: 0, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#2F2E2D" />
            </TouchableOpacity>
          </View>

          {/* Patient info: name / room / tablets + avatar */}
          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D' }} numberOfLines={2}>
                {patientName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="cube-outline" size={15} color="#2F2E2D" />
                <Text style={{ marginLeft: 7, fontSize: 13, lineHeight: 18, color: '#2F2E2D' }}>
                  Room {roomNumber}{age !== null ? ` • Age ${age}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <HealthIcon width={15} height={15} color="#2F2E2D" />
                <Text style={{ marginLeft: 7, fontSize: 13, lineHeight: 18, color: '#2F2E2D' }}>
                  {heroMedicationCount} tablets
                </Text>
              </View>
            </View>

            <Profile2Icon />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}
