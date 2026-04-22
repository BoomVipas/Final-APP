/**
 * app/(tabs)/_layout.tsx
 * Bottom tab navigator — 3 primary tabs matching the Figma shell.
 */

import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useNotificationStore } from '../../src/stores/notificationStore'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function createTabIcon(name: IoniconsName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} size={size} color={color} />
  }
}

export default function TabsLayout() {
  const unreadCount = useNotificationStore((state) => {
    const count = Number(state.unreadCount)
    return Number.isFinite(count) ? count : 0
  })
  const profileBadge = unreadCount > 0 ? Math.min(unreadCount, 99) : undefined

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#C96B1A',
        tabBarInactiveTintColor: '#2E241B',
        tabBarStyle: {
          backgroundColor: '#FFF9F2',
          borderTopColor: '#EADBCB',
          borderTopWidth: 1,
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          textTransform: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: createTabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Ward',
          tabBarIcon: createTabIcon('bed'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: createTabIcon('person'),
          tabBarBadge: profileBadge,
          tabBarBadgeStyle: {
            backgroundColor: '#B9382F',
            color: '#FFF9F2',
          },
        }}
      />
    </Tabs>
  )
}
