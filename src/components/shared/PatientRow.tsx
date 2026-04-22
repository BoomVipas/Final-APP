/**
 * src/components/shared/PatientRow.tsx
 * Patient list item for FlatList — minimum 48dp, circular avatar.
 */

import React from 'react'
import { Image, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import type { PatientsRow } from '../../types/database'

type PatientStatus = 'normal' | 'warning' | 'confirmed'

interface PatientRowProps {
  patient: PatientsRow
  status?: PatientStatus
  onPress?: () => void
  testID?: string
}

function getAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function getStatusBadgeProps(status: PatientStatus): { status: React.ComponentProps<typeof Badge>['status']; label: string } {
  switch (status) {
    case 'warning':
      return { status: 'warning', label: '⚠️ แจ้งเตือน' }
    case 'confirmed':
      return { status: 'confirmed', label: '✅ เสร็จ' }
    default:
      return { status: 'normal', label: 'ปกติ' }
  }
}

function Initials({ name }: { name: string }) {
  const initial = name.trim()[0] ?? '?'
  return (
    <View className="w-12 h-12 rounded-[18px] bg-[#F6EBDD] items-center justify-center">
      <Text className="text-[#B76819] font-bold text-lg">{initial}</Text>
    </View>
  )
}

export function PatientRow({ patient, status = 'normal', onPress, testID }: PatientRowProps) {
  const age = patient.date_of_birth ? getAge(patient.date_of_birth) : null
  const badge = getStatusBadgeProps(status)

  return (
    <Card onPress={onPress} testID={testID} className="mb-3 bg-[#FFF9F2]">
      <View className="flex-row items-center min-h-[48px]">
        <View className="mr-3">
          {patient.photo_url ? (
            <Image
              source={{ uri: patient.photo_url }}
              className="w-12 h-12 rounded-[18px]"
              resizeMode="cover"
            />
          ) : (
            <Initials name={patient.name} />
          )}
        </View>

        <View className="flex-1">
          <Text className="text-base font-bold text-[#2E241B]">{patient.name}</Text>
          <Text className="text-xs text-[#7D6E60] mt-1">
            {patient.room_number ? `ห้อง ${patient.room_number}` : 'ไม่ระบุห้อง'}
            {age !== null ? `  •  ${age} ปี` : ''}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Badge status={badge.status} label={badge.label} />
          <Ionicons name="chevron-forward" size={16} color="#B8A998" />
        </View>
      </View>
    </Card>
  )
}
