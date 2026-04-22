/**
 * src/components/ui/Button.tsx
 * Reusable button component with variants. Always full-width unless compact.
 */

import React from 'react'
import { ActivityIndicator, Pressable, Text } from 'react-native'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  compact?: boolean
  testID?: string
  className?: string
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: 'bg-[#C96B1A] rounded-[22px] border border-[#B25D14]',
    text: 'text-[#FFF9F2] font-semibold text-base',
  },
  secondary: {
    container: 'bg-[#FFF4E8] border border-[#E7C9A8] rounded-[22px]',
    text: 'text-[#8E4B14] font-semibold text-base',
  },
  danger: {
    container: 'bg-[#B9382F] rounded-[22px] border border-[#992B23]',
    text: 'text-[#FFF9F2] font-semibold text-base',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-[#8E4B14] font-semibold text-base',
  },
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  compact = false,
  testID,
  className = '',
}: ButtonProps) {
  const styles = variantStyles[variant]
  const isDisabled = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      className={`
        min-h-[48px]
        items-center
        justify-center
        px-6
        py-3.5
        ${compact ? '' : 'w-full'}
        ${styles.container}
        ${isDisabled ? 'opacity-50' : 'active:opacity-90'}
        ${className}
      `}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFF9F2' : '#C96B1A'}
          size="small"
        />
      ) : (
        <Text className={styles.text}>{title}</Text>
      )}
    </Pressable>
  )
}
