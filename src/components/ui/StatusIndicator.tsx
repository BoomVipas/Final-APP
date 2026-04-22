/**
 * src/components/ui/StatusIndicator.tsx
 * Large emoji + Thai label status block.
 */

import React from 'react'
import { Text, View } from 'react-native'

type StatusType = 'confirmed' | 'pending' | 'critical' | 'warning' | 'skipped'

interface StatusIndicatorProps {
  status: StatusType
  size?: 'small' | 'medium' | 'large'
  testID?: string
}

const statusConfig: Record<StatusType, { emoji: string; label_th: string; textColor: string }> = {
  confirmed: { emoji: '✅', label_th: 'จ่ายแล้ว', textColor: 'text-green-600' },
  pending: { emoji: '⏳', label_th: 'รอจ่าย', textColor: 'text-yellow-600' },
  critical: { emoji: '🔴', label_th: 'วิกฤต', textColor: 'text-red-600' },
  warning: { emoji: '⚠️', label_th: 'แจ้งเตือน', textColor: 'text-orange-500' },
  skipped: { emoji: '❌', label_th: 'ข้าม', textColor: 'text-gray-500' },
}

const sizeStyles = {
  small: { emoji: 'text-base', label: 'text-xs' },
  medium: { emoji: 'text-2xl', label: 'text-sm' },
  large: { emoji: 'text-4xl', label: 'text-base' },
}

export function StatusIndicator({ status, size = 'medium', testID }: StatusIndicatorProps) {
  const config = statusConfig[status]
  const sizes = sizeStyles[size]

  return (
    <View testID={testID} className="items-center gap-1">
      <Text className={sizes.emoji}>{config.emoji}</Text>
      <Text className={`${sizes.label} font-medium ${config.textColor}`}>{config.label_th}</Text>
    </View>
  )
}
