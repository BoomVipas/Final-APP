/**
 * src/lib/notifications.ts
 * Thin wrapper around expo-notifications for local refill / dose reminders.
 */

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const PUSH_TOKEN_KEY = 'pillo:expo_push_token'

let permissionsConfigured = false

async function ensurePermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync()
  if (settings.granted) return true

  const request = await Notifications.requestPermissionsAsync()
  return request.granted || request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('pillo-reminders', {
    name: 'PILLo Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  })
}

async function configureHandler() {
  if (permissionsConfigured) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
  permissionsConfigured = true
}

export interface RefillReminderInput {
  medicineName: string
  daysFromNow: number
  patientName?: string
}

export async function scheduleRefillReminder(input: RefillReminderInput): Promise<string | null> {
  await configureHandler()
  const granted = await ensurePermissions()
  if (!granted) return null

  await ensureAndroidChannel()

  const seconds = Math.max(60, Math.round(input.daysFromNow * 24 * 60 * 60))
  const fireAt = new Date(Date.now() + seconds * 1000)

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'หมายเตือน / Refill Reminder',
      body: input.patientName
        ? `${input.medicineName} for ${input.patientName} is running low.`
        : `${input.medicineName} is running low. Time to refill.`,
      sound: 'default',
      data: { kind: 'refill_reminder', medicineName: input.medicineName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: 'pillo-reminders',
    },
  })

  return id
}

export async function cancelReminder(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    // already fired or removed
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await configureHandler()
  const granted = await ensurePermissions()
  if (!granted) return null

  await ensureAndroidChannel()

  try {
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
    const result = await Notifications.getExpoPushTokenAsync()
    const token = result.data
    if (token && token !== cached) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
    }
    return token ?? null
  } catch {
    return null
  }
}

export async function getCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY)
  } catch {
    return null
  }
}
