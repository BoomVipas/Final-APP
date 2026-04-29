import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HomeIcon from '../../../icons/Home.svg'
import WardIcon from '../../../icons/Ward.svg'
import ProfileIcon from '../../../icons/Profile.svg'

type ActiveTab = 'home' | 'ward' | 'profile'

interface BottomNavProps {
  activeTab: ActiveTab
  onHome: () => void
  onWard: () => void
  onProfile: () => void
}

const ACTIVE_COLOR = '#F2A14C'
const INACTIVE_COLOR = '#2F2F2F'

export function BottomNav({ activeTab, onHome, onWard, onProfile }: BottomNavProps) {
  const insets = useSafeAreaInsets()

  const tabs: { key: ActiveTab; label: string; Icon: React.ComponentType<{ width: number; height: number; color: string }>; onPress: () => void }[] = [
    { key: 'home', label: 'Home', Icon: HomeIcon as any, onPress: onHome },
    { key: 'ward', label: 'Ward', Icon: WardIcon as any, onPress: onWard },
    { key: 'profile', label: 'Profile', Icon: ProfileIcon as any, onPress: onProfile },
  ]

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#ECE5DB',
        paddingHorizontal: 32,
        paddingTop: 12,
        paddingBottom: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {tabs.map(({ key, label, Icon, onPress }) => {
          const active = activeTab === key
          return (
            <TouchableOpacity
              key={key}
              onPress={onPress}
              style={{ alignItems: 'center', minWidth: 76 }}
              activeOpacity={0.7}
            >
              <Icon width={24} height={24} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '600' : '400',
                  color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                  marginTop: 5,
                }}
              >
                {label}
              </Text>
              {active ? (
                <View
                  style={{
                    marginTop: 5,
                    height: 3,
                    width: 24,
                    borderRadius: 99,
                    backgroundColor: ACTIVE_COLOR,
                  }}
                />
              ) : (
                <View style={{ marginTop: 5, height: 3 }} />
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
