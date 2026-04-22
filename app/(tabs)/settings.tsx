/**
 * app/(tabs)/settings.tsx
 * Profile / Settings screen — Figma redesign (2026-04-22)
 *
 * NOTE: Uses a plain View for the header background (#F2B860) instead of
 * expo-linear-gradient because that package is not yet installed.
 * Run `npx expo install expo-linear-gradient` and swap in LinearGradient
 * when ready.
 */

import React from 'react'
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthStore } from '../../src/stores/authStore'

// ─── Role label map ────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  nurse: 'Nurse Manager',
  caregiver: 'Caregiver',
  admin: 'Admin',
}

// ─── Reusable menu row ─────────────────────────────────────────────────────────
function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress?: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center min-h-[52px] px-4 py-3"
    >
      <Ionicons name={icon} size={20} color="#6B6B6B" style={{ marginRight: 14 }} />
      <Text className="flex-1 text-[15px] text-[#2E2E2E] font-medium">{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#C0C0C0" />
    </TouchableOpacity>
  )
}

// ─── Thin separator ────────────────────────────────────────────────────────────
function Separator() {
  return <View className="h-px bg-[#F0EDED] mx-4" />
}

// ─── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="text-xs text-[#9E9E9E] font-semibold uppercase tracking-wider ml-4 mt-5 mb-2">
      {title}
    </Text>
  )
}

// ─── Shared card shadow style ──────────────────────────────────────────────────
const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { user, signOut } = useAuthStore()

  const displayName = user?.name ?? 'Peeraya'
  const roleKey = user?.role ?? 'nurse'
  const roleLabel = ROLE_LABELS[roleKey] ?? 'Nurse Manager'
  const avatarLetter = displayName.trim()[0]?.toUpperCase() ?? 'P'

  const handleSignOut = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
            } catch {
              Alert.alert('Error', 'Unable to logout. Please try again.')
            }
          },
        },
      ],
    )
  }

  const handleNotImplemented = (feature: string) => {
    Alert.alert(feature, 'This feature will be available soon.')
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F5F0E8]" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* ── Header (warm orange, ~220px) ──────────────────────────────── */}
        <LinearGradient
          colors={['#F2C060', '#EEA060']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 220,
            paddingTop: 20,
            paddingBottom: 28,
            paddingHorizontal: 20,
            overflow: 'hidden',
          }}
        >
          {/* Decorative semi-transparent bubble circles */}
          <View
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 35,
              right: 55,
              width: 85,
              height: 85,
              borderRadius: 42,
              backgroundColor: 'rgba(255,255,255,0.13)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 90,
              right: -12,
              width: 65,
              height: 65,
              borderRadius: 32,
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -20,
              left: -20,
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: 'rgba(255,255,255,0.10)',
            }}
          />

          {/* Profile row */}
          <View className="flex-row items-center mt-4">

            {/* Avatar with camera icon overlay */}
            <View style={{ position: 'relative', marginRight: 16 }}>
              {/* White ring */}
              <View
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  backgroundColor: 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 5,
                }}
              >
                {/* Coloured avatar circle */}
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: '#EEA060',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 38, fontWeight: '700', color: '#7A4210' }}>
                    {avatarLetter}
                  </Text>
                </View>
              </View>

              {/* Camera overlay button */}
              <TouchableOpacity
                onPress={() => handleNotImplemented('Change Photo')}
                activeOpacity={0.8}
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'white',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 3,
                }}
              >
                <Ionicons name="camera" size={14} color="#555" />
              </TouchableOpacity>
            </View>

            {/* Name / role / Edit Profile */}
            <View className="flex-1">
              <Text
                style={{ fontSize: 22, fontWeight: '700', color: '#2E1A0E', lineHeight: 28 }}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="medical" size={13} color="#7A4210" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: '#7A4210', fontWeight: '600' }}>
                  {roleLabel}
                </Text>
              </View>

              {/* Edit Profile pill */}
              <TouchableOpacity
                onPress={() => handleNotImplemented('Edit Profile')}
                activeOpacity={0.75}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 10,
                  borderWidth: 1.5,
                  borderColor: 'white',
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  minHeight: 34,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ── Main Menu ─────────────────────────────────────────────────── */}
        <SectionLabel title="Main Menu" />
        <View className="mx-4 bg-white rounded-2xl overflow-hidden" style={cardShadow}>
          <MenuRow
            icon="bar-chart-outline"
            label="Dispensing Report"
            onPress={() => handleNotImplemented('Dispensing Report')}
          />
          <Separator />
          <MenuRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => handleNotImplemented('Notifications')}
          />
        </View>

        {/* ── System ────────────────────────────────────────────────────── */}
        <SectionLabel title="System" />
        <View className="mx-4 bg-white rounded-2xl overflow-hidden" style={cardShadow}>
          <MenuRow
            icon="settings-outline"
            label="Settings"
            onPress={() => handleNotImplemented('Settings')}
          />
          <Separator />
          <MenuRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => handleNotImplemented('Change Password')}
          />
        </View>

        {/* ── Logout button ─────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.75}
          className="mx-4 mt-4 bg-white rounded-2xl min-h-[52px] items-center justify-center"
          style={cardShadow}
        >
          <Text className="text-[15px] font-bold text-[#2E2E2E]">Logout</Text>
        </TouchableOpacity>

        {/* ── Version ───────────────────────────────────────────────────── */}
        <Text className="text-xs text-center text-[#ADADAD] mt-4 mb-8">Version 1.1.2</Text>
      </ScrollView>
    </SafeAreaView>
  )
}
