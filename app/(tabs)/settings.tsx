import React, { useEffect, useState } from 'react'
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Tabs, useRouter } from 'expo-router'
import BackgroundSettingImage from '../../icons/Backgroundsetting.png'
import HomeIcon from '../../icons/Home.png'
import WardIcon from '../../icons/Ward.png'
import ProfileIcon from '../../icons/Profile.png'
import { useIsFocused } from '@react-navigation/native'

import { useAuthStore } from '../../src/stores/authStore'
import { supabase } from '../../src/lib/supabase'
import type { UserRole, UsersRow } from '../../src/types/database'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  caregiver: 'Caregiver',
  nurse: 'Nurse Manager',
}

const CARD_SHADOW = {
  shadowColor: '#8A6440',
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 10 },
  elevation: 5,
}

type MenuItemProps = {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
}

function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.menuRow}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={20} color="#32302F" />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#403D3C" />
    </Pressable>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

async function fetchProfile(userId: string): Promise<UsersRow | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, phone, role, ward_id, created_at')
    .eq('id', userId)
    .maybeSingle()

  return (data as UsersRow | null) ?? null
}

function BottomNav({ onHome, onWard, onProfile }: { onHome: () => void; onWard: () => void; onProfile: () => void }) {
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#ECE5DB', paddingHorizontal: 32, paddingTop: 12, paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={onHome} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={HomeIcon} style={{ width: 30, height: 30, tintColor: '#2F2F2F' }} />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onWard} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={WardIcon} style={{ width: 30, height: 30, tintColor: '#2F2F2F' }} />
          <Text style={{ fontSize: 11, color: '#2F2F2F', marginTop: 6 }}>Ward</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfile} style={{ alignItems: 'center', minWidth: 76 }}>
          <Image source={ProfileIcon} style={{ width: 30, height: 30, tintColor: '#F2A14C' }} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#2F2F2F', marginTop: 6 }}>Profile</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 6, width: 128, borderRadius: 999, alignSelf: 'center', marginTop: 16 }} />
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const isFocused = useIsFocused()
  const { user, signOut } = useAuthStore()
  const [profile, setProfile] = useState<UsersRow | null>(user)

  useEffect(() => {
    setProfile(user)
  }, [user])

  useEffect(() => {
    let active = true

    if (!isFocused || !user?.id) return () => { active = false }

    ;(async () => {
      const latest = await fetchProfile(user.id)
      if (active && latest) {
        setProfile(latest)
      }
    })()

    return () => {
      active = false
    }
  }, [isFocused, user?.id])

  const currentProfile = profile ?? user
  const displayName = currentProfile?.name?.trim() || 'Peeraya'
  const role = currentProfile?.role ?? 'nurse'
  const roleLabel = ROLE_LABELS[role]
  const showReport = role === 'admin' || role === 'nurse'
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'P'

  const handleSignOut = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut()
          } catch {
            Alert.alert('Error', 'Unable to logout right now.')
          }
        },
      },
    ])
  }

  const handleNotifications = () => {
    router.push('/notifications')
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <SafeAreaView style={[styles.safeArea, { flex: 1 }]} edges={['left', 'right']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground source={BackgroundSettingImage} style={styles.hero} resizeMode="cover">
          <View style={styles.heroRow}>
            <View style={styles.avatarOuter}>
              <LinearGradient
                colors={['#EFF4F8', '#D9E6F2']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarInner}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
              <Pressable style={styles.cameraButton} onPress={() => router.push('/edit-profile')}>
                <Ionicons name="camera" size={15} color="#2E2C2A" />
              </Pressable>
            </View>

            <View style={styles.heroTextWrap}>
              <Text numberOfLines={1} style={styles.heroName}>
                {displayName}
              </Text>
              <View style={styles.roleRow}>
                <Ionicons name="medkit-outline" size={15} color="#33312F" />
                <Text style={styles.roleText}>{roleLabel}</Text>
              </View>
              <Pressable onPress={() => router.push('/edit-profile')} style={styles.editButton}>
                <Ionicons name="create-outline" size={14} color="#2E2C2A" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        <SectionTitle>Main Menu</SectionTitle>
        <View style={[styles.menuCard, CARD_SHADOW]}>
          {showReport ? (
            <>
              <MenuItem
                icon="bar-chart"
                label="Dispensing Report"
                onPress={() => router.push('/report')}
              />
              <View style={styles.divider} />
            </>
          ) : null}
          <MenuItem
            icon="notifications"
            label="Notifications"
            onPress={handleNotifications}
          />
        </View>

        <SectionTitle>System</SectionTitle>
        <View style={[styles.menuCard, CARD_SHADOW]}>
          <MenuItem
            icon="settings"
            label="Settings"
            onPress={() => router.push('/preferences')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="lock-closed"
            label="Change Password"
            onPress={() => router.push('/change-password')}
          />
        </View>

        <Pressable onPress={handleSignOut} style={[styles.logoutButton, CARD_SHADOW]}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.versionText}>Version 1.1.2</Text>
      </ScrollView>
    </SafeAreaView>
    <BottomNav
      onHome={() => router.replace('/(tabs)')}
      onWard={() => router.replace('/(tabs)/patients')}
      onProfile={() => router.replace('/(tabs)/settings')}
    />
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  content: {
    paddingBottom: 10,
  },
  hero: {
    width: Dimensions.get('window').width,
    minHeight: 220,
    paddingHorizontal: 18,
    paddingTop: 30,
    paddingBottom: 20,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroGlowLeft: {
    position: 'absolute',
    left: -24,
    top: 14,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  heroGlowRight: {
    position: 'absolute',
    right: -18,
    bottom: 18,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  heroIllustration: {
    position: 'absolute',
    right: 8,
    top: 16,
    width: 160,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  heroIllustrationPanel: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 104,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(60, 47, 39, 0.08)',
  },
  heroIllustrationDesk: {
    position: 'absolute',
    right: 24,
    bottom: 10,
    width: 86,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(60, 47, 39, 0.07)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  avatarOuter: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...CARD_SHADOW,
  },
  avatarInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2830',
    letterSpacing: 0.5,
  },
  cameraButton: {
    position: 'absolute',
    right: -2,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EFF0F2',
  },
  heroTextWrap: {
    flex: 1,
    paddingBottom: 4,
  },
  heroName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#2F2D2B',
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  roleText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2F2D2B',
    fontWeight: '500',
  },
  editButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2F2D2B',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#97928B',
    fontWeight: '400',
  },
  menuCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#2F2D2B',
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E1DB',
    marginLeft: 16,
  },
  logoutButton: {
    minHeight: 52,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#2F2D2B',
  },
  versionText: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#7A756F',
    textAlign: 'center',
  },
})
