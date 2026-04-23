/**
 * src/lib/devAuth.ts
 * Temporary developer auth bypass for product work before real auth is finalized.
 */

import type { UsersRow } from '../types/database'

// Temporary: keep the product accessible without a login wall during build-out.
export const AUTH_BYPASS_ENABLED = true

export const DEV_BYPASS_USER: UsersRow = {
  id: '00000000-0000-0000-0000-00000000d001',
  email: 'dev@pillo.local',
  name: 'PILLo Dev User',
  phone: null,
  role: 'admin',
  ward_id: 'ward-1',
  created_at: new Date(0).toISOString(),
}
