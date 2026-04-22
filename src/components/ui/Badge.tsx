/**
 * src/components/ui/Badge.tsx
 * Small pill badge for status display.
 */

import React from 'react'
import { Text, View } from 'react-native'

type BadgeStatus = 'confirmed' | 'pending' | 'critical' | 'normal' | 'warning' | 'refused' | 'missed' | 'duplicate' | 'held'

export interface BadgeProps {
  status: BadgeStatus
  label: string
  testID?: string
}

const statusStyles: Record<BadgeStatus, { container: string; text: string }> = {
  confirmed: { container: 'bg-[#E4F2E6]', text: 'text-[#2F6B55]' },
  pending: { container: 'bg-[#FFF0D9]', text: 'text-[#A45A11]' },
  critical: { container: 'bg-[#F8DDDA]', text: 'text-[#A3322A]' },
  normal: { container: 'bg-[#EFE7DD]', text: 'text-[#6F6254]' },
  warning: { container: 'bg-[#FFE7C7]', text: 'text-[#B76819]' },
  refused: { container: 'bg-[#F8DDDA]', text: 'text-[#A3322A]' },
  missed: { container: 'bg-[#ECE7E0]', text: 'text-[#6F6254]' },
  duplicate: { container: 'bg-[#F8DDDA]', text: 'text-[#A3322A]' },
  held: { container: 'bg-[#DBEAFE]', text: 'text-[#295B97]' },
}

export function Badge({ status, label, testID }: BadgeProps) {
  const styles = statusStyles[status] ?? statusStyles.normal

  return (
    <View
      testID={testID}
      className={`px-3 py-1 rounded-full self-start ${styles.container}`}
    >
      <Text className={`text-[11px] font-semibold ${styles.text}`}>{label}</Text>
    </View>
  )
}
