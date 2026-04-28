import React, { useState } from 'react'
import {
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
import { isDevAuthBypassActive } from '../src/lib/devAuth'

export default function ChangePasswordScreen() {
  const router = useRouter()
  const { session } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const bypassActive = isDevAuthBypassActive || !session

  const handleSave = async () => {
    if (bypassActive) {
      Alert.alert(
        'Unavailable in dev bypass',
        'Password changes require a real authenticated session.',
      )
      return
    }

    if (!currentPassword.trim()) {
      Alert.alert('Missing password', 'Enter your current password to continue.')
      return
    }

    if (nextPassword.length < 8) {
      Alert.alert('Weak password', 'Your new password must be at least 8 characters long.')
      return
    }

    if (nextPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm the same new password.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword })
      if (error) throw error

      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error) {
      Alert.alert(
        'Unable to update password',
        error instanceof Error ? error.message : 'Please try again.',
      )
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#FFF7ED', '#FBD7A8', '#F3A449']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
            </Pressable>
            <Text style={styles.heroTitle}>Change Password</Text>
            <Text style={styles.heroSubtitle}>Keep your account secure.</Text>
          </LinearGradient>

          <View style={styles.card}>
            {bypassActive ? (
              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={24} color="#AA6D1F" />
                <Text style={styles.noticeText}>
                  Password changes are disabled while the app is using the dev authentication bypass.
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Current Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Enter current password"
              placeholderTextColor="#A19A91"
              style={styles.input}
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              value={nextPassword}
              onChangeText={setNextPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Minimum 8 characters"
              placeholderTextColor="#A19A91"
              style={styles.input}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Re-enter new password"
              placeholderTextColor="#A19A91"
              style={styles.input}
            />

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Updating...' : 'Update Password'}
              </Text>
            </Pressable>
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
    paddingBottom: 32,
  },
  hero: {
    minHeight: 210,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 28,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 22,
    color: '#5D554D',
  },
  card: {
    marginTop: -18,
    marginHorizontal: 22,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    padding: 22,
    shadowColor: '#8A6440',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF2DD',
    marginBottom: 18,
  },
  noticeText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#7C623F',
  },
  label: {
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 20,
    color: '#4C4743',
    fontWeight: '600',
  },
  input: {
    minHeight: 56,
    marginBottom: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FCFAF6',
    fontSize: 17,
    color: '#2F2D2B',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7A64B',
    marginTop: 8,
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
