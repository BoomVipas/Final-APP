import React from 'react'
import { Image, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import ProfileMaleAvatar from '../../../icons/profile_1.svg'
import ProfileFemaleAvatar from '../../../icons/profile_2.svg'

interface PatientAvatarProps {
  name: string
  photoUrl?: string | null
  size?: number
  borderWidth?: number
  borderColor?: string
  className?: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

function isFemalePatientName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  const femalePrefixes = ['mrs.', 'ms.', 'miss', 'madam', 'นางสาว', 'นาง']
  return femalePrefixes.some((prefix) => normalized.startsWith(prefix))
}

export function PatientAvatar({
  name,
  photoUrl,
  size = 48,
  borderWidth = 0,
  borderColor = '#FFFFFF',
  className,
  style,
  children,
}: PatientAvatarProps) {
  const Avatar = (isFemalePatientName(name) ? ProfileFemaleAvatar : ProfileMaleAvatar) as unknown
  const AvatarComponent = typeof Avatar === 'function'
    ? (Avatar as React.ComponentType<{ width?: number; height?: number }>)
    : null
  const radius = size / 2

  return (
    <View
      className={className}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth,
          borderColor,
          overflow: 'hidden',
          backgroundColor: '#F4A851',
        },
        style,
      ]}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : AvatarComponent ? (
        <AvatarComponent width={size} height={size} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {children}
    </View>
  )
}
