import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useAuthStore } from '../src/stores/authStore'
import { supabase } from '../src/lib/supabase'
import type { UsersRow } from '../src/types/database'

const INPUT_SHADOW = {
  shadowColor: '#906A46',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
}

async function fetchProfile(userId: string): Promise<UsersRow | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, phone, role, ward_id, created_at')
    .eq('id', userId)
    .maybeSingle()

  return (data as UsersRow | null) ?? null
}

export default function EditProfileScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState('Nurse Manager')

  useEffect(() => {
    let active = true

    ;(async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      const latest = (await fetchProfile(user.id)) ?? user
      if (!active) return

      setName(latest.name ?? '')
      setPhone(latest.phone ?? '')
      setEmail(latest.email ?? '')
      setRoleLabel(
        latest.role === 'admin'
          ? 'Administrator'
          : latest.role === 'caregiver'
            ? 'Caregiver'
            : 'Nurse Manager',
      )
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [user])

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User profile is unavailable.')
      return
    }

    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter your display name.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
        })
        .eq('id', user.id)

      if (error) throw error

      Alert.alert('Profile updated', 'Your profile changes have been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error) {
      Alert.alert('Unable to save', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#FFF7ED', '#FDD8AB', '#F6A84C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
            </Pressable>
            <Text style={styles.heroTitle}>Edit Profile</Text>
            <Text style={styles.heroSubtitle}>Update your account details.</Text>

            <View style={styles.avatarWrap}>
              <View style={styles.avatarOuter}>
                <LinearGradient
                  colors={['#EFF4F8', '#D9E6F2']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarInner}
                >
                  <Text style={styles.avatarText}>
                    {name.trim().slice(0, 2).toUpperCase() || 'PP'}
                  </Text>
                </LinearGradient>
              </View>
              <Text style={styles.heroRole}>{roleLabel}</Text>
            </View>
          </LinearGradient>

          <View style={[styles.formCard, INPUT_SHADOW]}>
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color="#ED9A41" />
              </View>
            ) : (
              <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="#9A958E"
                  style={styles.input}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  editable={false}
                  selectTextOnFocus={false}
                  style={[styles.input, styles.inputDisabled]}
                />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Add your phone number"
                  placeholderTextColor="#9A958E"
                  style={styles.input}
                />

                <View style={styles.buttonRow}>
                  <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.primaryButton, saving && styles.buttonDisabled]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  content: {
    paddingBottom: 36,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 28,
    minHeight: 300,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.54)',
  },
  heroTitle: {
    marginTop: 20,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 24,
    color: '#5C534A',
  },
  avatarWrap: {
    marginTop: 28,
    alignItems: 'center',
  },
  avatarOuter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarInner: {
    width: 106,
    height: 106,
    borderRadius: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2830',
  },
  heroRole: {
    marginTop: 14,
    fontSize: 18,
    color: '#3D3732',
  },
  formCard: {
    marginTop: -12,
    marginHorizontal: 22,
    padding: 22,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  loadingState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: '#4B4743',
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FCFAF6',
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#2F2D2B',
    marginBottom: 18,
  },
  inputDisabled: {
    color: '#8C877F',
    backgroundColor: '#F4F0EA',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7DED2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#504A44',
  },
  primaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7A64B',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2F2D2B',
  },
})
