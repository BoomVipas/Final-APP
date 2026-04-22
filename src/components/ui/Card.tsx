/**
 * src/components/ui/Card.tsx
 * Base card component — white, rounded, shadowed. Reskinnable via NativeWind.
 */

import React from 'react'
import { Pressable, View } from 'react-native'

interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  className?: string
  testID?: string
}

export function Card({ children, onPress, className = '', testID }: CardProps) {
  const base = `bg-[#FFFDF8] rounded-[28px] border border-[#EADBCB] p-4 ${className}`

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        className={`min-h-[48px] ${base} active:opacity-90`}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <View testID={testID} className={base}>
      {children}
    </View>
  )
}
