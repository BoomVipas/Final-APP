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
import { View, ActivityIndicator, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { USE_MOCK, initMockStores } from '../src/mocks'
import { isDevAuthBypassActive } from '../src/lib/devAuth'
import { colors, typo } from '../src/theme/typo'

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

    if (isDevAuthBypassActive) {
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

function DevAuthBypassBanner() {
  if (!isDevAuthBypassActive) return null
  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.softOrange }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLabel="โหมดข้ามการล็อกอิน เปิดอยู่สำหรับนักพัฒนาเท่านั้น"
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.softOrange,
          borderBottomWidth: 1,
          borderBottomColor: colors.gentleAmber,
        }}
      >
        <Text
          style={{
            ...typo.labelMedium,
            color: colors.text,
            textAlign: 'center',
          }}
        >
          โหมดข้ามการล็อกอิน (DEV) / Auth bypass active (DEV only)
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default function RootLayout() {
  return (
    <AuthGate>
      <DevAuthBypassBanner />
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
            headerBackTitle: 'Back',
            headerTintColor: '#E8721A',
            headerTitleStyle: { fontWeight: '700' },
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
