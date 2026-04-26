/**
 * src/lib/devAuth.ts
 * Temporary developer auth bypass for product work before real auth is finalized.
 */

import type { UsersRow } from '../types/database'

const AUTH_BYPASS_FLAG = true

// __DEV__ gate ensures the bypass is impossible to ship in a production bundle,
// even if AUTH_BYPASS_FLAG is accidentally left as `true`.
export const isDevAuthBypassActive: boolean = __DEV__ && AUTH_BYPASS_FLAG

export const DEV_BYPASS_USER: UsersRow = {
  id: '00000000-0000-0000-0000-00000000d001',
  email: 'dev@pillo.local',
  name: 'PILLo Dev User',
  phone: null,
  role: 'admin',
  ward_id: 'ward-1',
  created_at: new Date(0).toISOString(),
}
