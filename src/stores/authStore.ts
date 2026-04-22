/**
 * src/stores/authStore.ts
 * Zustand store for authentication state.
 */

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { UsersRow } from '../types/database'
import { AUTH_BYPASS_ENABLED, DEV_BYPASS_USER } from '../lib/devAuth'

interface AuthState {
  user: UsersRow | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => void
}

async function fetchUser(userId: string): Promise<UsersRow | null> {
  const { data } = await supabase
    .from('users')
    .select('id, email, name, phone, role, ward_id, created_at')
    .eq('id', userId)
    .single()
  return data ?? null
}

async function ensureBypassUser(): Promise<UsersRow> {
  const { data: existing } = await supabase
    .from('users')
    .select('id, email, name, phone, role, ward_id, created_at')
    .eq('id', DEV_BYPASS_USER.id)
    .maybeSingle()

  if (existing) return existing as UsersRow

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: DEV_BYPASS_USER.id,
      email: DEV_BYPASS_USER.email,
      name: DEV_BYPASS_USER.name,
      phone: DEV_BYPASS_USER.phone,
      role: DEV_BYPASS_USER.role,
      ward_id: DEV_BYPASS_USER.ward_id,
    })
    .select('id, email, name, phone, role, ward_id, created_at')
    .single()

  if (error) {
    // If the insert fails, keep a local fallback so the app remains usable.
    return DEV_BYPASS_USER
  }

  return (data as UsersRow) ?? DEV_BYPASS_USER
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    if (AUTH_BYPASS_ENABLED) {
      const user = await ensureBypassUser()
      set({ user, session: null, loading: false })
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const user = data.user ? await fetchUser(data.user.id) : null
    if (data.user && !user) {
      await supabase.auth.signOut()
      throw new Error('ไม่พบโปรไฟล์ผู้ใช้ในฐานข้อมูล users')
    }
    set({ user, session: data.session })
  },

  signOut: async () => {
    if (AUTH_BYPASS_ENABLED) {
      const user = await ensureBypassUser()
      set({ user, session: null, loading: false })
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null, session: null })
  },

  initialize: () => {
    if (AUTH_BYPASS_ENABLED) {
      ensureBypassUser()
        .then((user) => {
          set({ user, session: null, loading: false })
        })
        .catch(() => {
          set({ user: DEV_BYPASS_USER, session: null, loading: false })
        })
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = await fetchUser(session.user.id)
        if (!user) {
          await supabase.auth.signOut()
          set({ user: null, session: null, loading: false })
          return
        }
        set({ user, session, loading: false })
      } else {
        set({ loading: false })
      }
    })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        set({ user: null, session: null, loading: false })
        return
      }
      const user = await fetchUser(session.user.id)
      if (!user) {
        await supabase.auth.signOut()
        set({ user: null, session: null, loading: false })
        return
      }
      set({ user, session, loading: false })
    })
  },
}))
