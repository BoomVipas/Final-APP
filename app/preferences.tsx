import React, { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

const STORAGE_KEY = 'pillo.preferences'

type PreferencesState = {
  language: 'en' | 'th'
  fontSize: 'standard' | 'large'
  notificationSound: boolean
}

const DEFAULT_PREFERENCES: PreferencesState = {
  language: 'en',
  fontSize: 'standard',
  notificationSound: true,
}

function SegmentButton({
  selected,
  label,
  onPress,
}: {
  selected: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, selected && styles.segmentButtonSelected]}
    >
      <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{label}</Text>
    </Pressable>
  )
}

export default function PreferencesScreen() {
  const router = useRouter()
  const [preferences, setPreferences] = useState<PreferencesState>(DEFAULT_PREFERENCES)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (!stored || !active) return

        const parsed = JSON.parse(stored) as PreferencesState
        setPreferences({
          fontSize: parsed.fontSize ?? DEFAULT_PREFERENCES.fontSize,
          language: parsed.language ?? DEFAULT_PREFERENCES.language,
          notificationSound: parsed.notificationSound ?? DEFAULT_PREFERENCES.notificationSound,
        })
      } catch {
        // Ignore malformed preferences and fall back to defaults.
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
      Alert.alert('Settings saved', 'Your preferences have been stored on this device.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Unable to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FFF7ED', '#FCD8AB', '#F2A246']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
          </Pressable>
          <Text style={styles.heroTitle}>Settings</Text>
          <Text style={styles.heroSubtitle}>Personalize the app experience.</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Language</Text>
          <View style={styles.segmentRow}>
            <SegmentButton
              selected={preferences.language === 'en'}
              label="English"
              onPress={() => setPreferences((current) => ({ ...current, language: 'en' }))}
            />
            <SegmentButton
              selected={preferences.language === 'th'}
              label="Thai"
              onPress={() => setPreferences((current) => ({ ...current, language: 'th' }))}
            />
          </View>

          <Text style={styles.cardTitle}>Font Size</Text>
          <View style={styles.segmentRow}>
            <SegmentButton
              selected={preferences.fontSize === 'standard'}
              label="Standard"
              onPress={() => setPreferences((current) => ({ ...current, fontSize: 'standard' }))}
            />
            <SegmentButton
              selected={preferences.fontSize === 'large'}
              label="Large"
              onPress={() => setPreferences((current) => ({ ...current, fontSize: 'large' }))}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={styles.switchTitle}>Notification Sound</Text>
              <Text style={styles.switchSubtitle}>Play a tone when reminders are triggered.</Text>
            </View>
            <Switch
              value={preferences.notificationSound}
              onValueChange={(value) =>
                setPreferences((current) => ({ ...current, notificationSound: value }))
              }
              trackColor={{ false: '#D8D2CA', true: '#F4B261' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Preferences'}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8A6440',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2F2D2B',
    marginBottom: 12,
    marginTop: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  segmentButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FAF7F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: '#F7B057',
    borderColor: '#F7B057',
  },
  segmentLabel: {
    fontSize: 16,
    lineHeight: 20,
    color: '#5A554F',
    fontWeight: '500',
  },
  segmentLabelSelected: {
    color: '#2F2D2B',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 20,
    backgroundColor: '#FAF7F1',
    padding: 16,
    marginBottom: 26,
  },
  switchLabelWrap: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: '#2F2D2B',
    fontWeight: '600',
  },
  switchSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    color: '#7B746C',
  },
  primaryButton: {
    minHeight: 56,
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
