/**
 * src/components/shared/StockAlert.tsx
 * Stock depletion alert card — orange for warning, red for critical.
 */

import React from 'react'
import { Text, View } from 'react-native'
import { Card } from '../ui/Card'

interface StockAlertProps {
  medicationName: string
  medicationNameEn?: string
  patientName: string
  currentCount: number
  unit: string
  daysRemaining: number | null
  estimatedDepletionDate: string | null
  severity: 'warning' | 'critical'
  onPress?: () => void
  testID?: string
}

export function StockAlert({
  medicationName,
  medicationNameEn,
  patientName,
  currentCount,
  unit,
  daysRemaining,
  estimatedDepletionDate,
  severity,
  onPress,
  testID,
}: StockAlertProps) {
  const isCritical = severity === 'critical'
  const bgColor = isCritical ? 'bg-red-50' : 'bg-orange-50'
  const borderColor = isCritical ? 'border-red-300' : 'border-orange-300'
  const titleColor = isCritical ? 'text-red-800' : 'text-orange-800'
  const subtitleColor = isCritical ? 'text-red-600' : 'text-orange-600'
  const countColor = isCritical ? 'text-red-700' : 'text-orange-700'
  const emoji = isCritical ? '🔴' : '⚠️'

  const depletionText = estimatedDepletionDate
    ? new Date(estimatedDepletionDate).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      })
    : null

  return (
    <Card
      onPress={onPress}
      testID={testID}
      className={`${bgColor} border ${borderColor} mb-2`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className={`text-sm font-bold ${titleColor}`}>
            {emoji} {medicationName}
          </Text>
          {medicationNameEn && (
            <Text className={`text-xs ${subtitleColor} mt-0.5`}>{medicationNameEn}</Text>
          )}
          <Text className={`text-xs ${subtitleColor} mt-1`}>👤 {patientName}</Text>
        </View>

        <View className="items-end">
          <Text className={`text-xl font-bold ${countColor}`}>{currentCount}</Text>
          <Text className={`text-xs ${subtitleColor}`}>{unit}</Text>
        </View>
      </View>

      <View className="flex-row items-center mt-2 gap-3">
        {daysRemaining !== null && (
          <View className={`px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-100' : 'bg-orange-100'}`}>
            <Text className={`text-xs font-medium ${countColor}`}>
              เหลือ {daysRemaining} วัน
            </Text>
          </View>
        )}
        {depletionText && (
          <Text className={`text-xs ${subtitleColor}`}>หมดประมาณ {depletionText}</Text>
        )}
      </View>
    </Card>
  )
}
