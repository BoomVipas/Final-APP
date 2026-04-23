/**
 * app/_layout.tsx
 * Root layout — auth gate + Expo Router Stack setup.
 * When USE_MOCK=true all stores are pre-seeded with mock data
 * so the app runs without any Supabase connection.
 */

import '../global.css'
import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '../src/stores/authStore'
import { View, ActivityIndicator } from 'react-native'
import { USE_MOCK, initMockStores } from '../src/mocks'
import { AUTH_BYPASS_ENABLED } from '../src/lib/devAuth'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, initialize } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (USE_MOCK) {
      // Seed all stores with mock data — no Supabase needed
      initMockStores()
    } else {
      initialize()
    }
  }, [])

  useEffect(() => {
    if (loading) return

    const protectedRoots = new Set([
      '(tabs)',
      'patient',
      'ward',
      'handover',
      'scanner',
      'notifications',
      'edit-profile',
      'change-password',
      'preferences',
      'report',
      'add-medication',
    ])
    const inAuthGroup = protectedRoots.has(segments[0] ?? '')
    const inLoginScreen = segments[0] === 'login'

    if (AUTH_BYPASS_ENABLED) {
      if (inLoginScreen) router.replace('/(tabs)')
    } else if (!session && inAuthGroup) {
      router.replace('/login')
    } else if (session && inLoginScreen) {
      router.replace('/(tabs)')
    }
  }, [session, loading, segments])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#E8721A" />
      </View>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="patient/[id]"
          options={{
            headerShown: true,
            title: 'ข้อมูลผู้ป่วย',
            headerTintColor: '#E8721A',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
        <Stack.Screen
          name="ward/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="handover"
          options={{
            headerShown: true,
            title: 'สรุปกะที่ผ่านมา',
            headerTintColor: '#E8721A',
            headerTitleStyle: { fontWeight: '700' },
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="scanner"
          options={{
            headerShown: true,
            title: 'Scan Medication',
            headerBackTitle: 'Back',
            headerTintColor: '#E8721A',
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
      </Stack>
    </AuthGate>
  )
}
