/**
 * src/mocks/useMockData.ts
 *
 * Initializes all Zustand stores with mock data so the app
 * runs without any Supabase connection.
 *
 * Call initMockStores() once in your root layout when USE_MOCK is true.
 */

import { useAuthStore } from '../stores/authStore'
import { useMedicationStore } from '../stores/medicationStore'
import { usePatientStore } from '../stores/patientStore'
import { useNotificationStore } from '../stores/notificationStore'
import {
  MOCK_CAREGIVER,
  MOCK_PATIENTS,
  MOCK_SCHEDULE_GROUPS,
  MOCK_ACTIVE_ALERTS,
  MOCK_NOTIFICATIONS,
  computeMockCounts,
} from './data'

/**
 * Seeds all stores with mock data.
 * Call once on app mount when USE_MOCK = true.
 */
export function initMockStores() {
  const counts = computeMockCounts()

  // Auth store — logged-in user, no loading
  useAuthStore.setState({
    user: MOCK_CAREGIVER,
    session: {
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      user: { id: 'user-001', email: 'prontip@pillo.care' } as any,
      expires_in: 3600,
      token_type: 'bearer',
    } as any,
    loading: false,
  })

  // Patient store — ward-1 patients loaded
  usePatientStore.setState({
    patients: MOCK_PATIENTS,
    selectedPatient: null,
    loading: false,
    error: null,
  })

  // Medication store — today's schedule pre-loaded
  useMedicationStore.setState({
    scheduleGroups: MOCK_SCHEDULE_GROUPS,
    pendingCount: counts.pending,
    completedCount: counts.completed,
    loading: false,
    error: null,
  })

  // Notification store — alerts + notifications
  useNotificationStore.setState({
    notifications: MOCK_NOTIFICATIONS,
    activeAlerts: MOCK_ACTIVE_ALERTS,
    loading: false,
    error: null,
  })
}

/**
 * Mock confirmDose — updates schedule item status locally.
 */
export function mockConfirmDose(prescriptionId: string, mealTime: string) {
  const store = useMedicationStore.getState()
  const updated = store.scheduleGroups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.prescription_id === prescriptionId && item.meal_time === mealTime
        ? { ...item, status: 'confirmed' as const, log_id: `mock-log-${Date.now()}`, conflict_flag: false }
        : item,
    ),
  }))

  const allItems = updated.flatMap((g) => g.items)
  useMedicationStore.setState({
    scheduleGroups: updated,
    pendingCount: allItems.filter((i) => i.status === 'pending').length,
    completedCount: allItems.filter((i) => i.status === 'confirmed').length,
  })
}

/**
 * Mock select patient — sets selectedPatient in patientStore.
 */
export function mockSelectPatient(patientId: string) {
  const { patients } = usePatientStore.getState()
  const patient = patients.find((p) => p.id === patientId) ?? null
  usePatientStore.setState({ selectedPatient: patient })
}

/**
 * Mock mark notification as read (no-op since NotificationLogsRow has no read_at).
 */
export function mockMarkNotificationRead(_id: string) {
  // notification_logs schema has no read_at column — no-op
}