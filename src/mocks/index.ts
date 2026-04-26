/**
 * src/mocks/index.ts
 *
 * Mock mode now auto-disables when Expo public Supabase credentials are
 * present. Set EXPO_PUBLIC_USE_MOCK=true to force local mock data.
 */

const hasSupabaseEnv = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
)

export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true' || !hasSupabaseEnv

export { initMockStores, mockConfirmDose, mockSelectPatient, mockMarkNotificationRead } from './useMockData'
export { MOCK_CAREGIVER, MOCK_WARD_CAREGIVERS, MOCK_PATIENTS, MOCK_MEDICINES, MOCK_PRESCRIPTIONS, MOCK_SCHEDULE_GROUPS, MOCK_ACTIVE_ALERTS, MOCK_NOTIFICATIONS, MOCK_HANDOVER, MOCK_HANDOVER_HISTORY, computeMockCounts } from './data'
