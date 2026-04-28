/**
 * src/stores/authStore.ts
 * Zustand store for authentication state.
 */

import { create } from 'zustand'
import { Platform } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { supabase } from '../lib/supabase'
import type { UsersRow } from '../types/database'
import { isDevAuthBypassActive, DEV_BYPASS_USER } from '../lib/devAuth'
import { registerForPushNotificationsAsync } from '../lib/notifications'

function attemptPushRegistration() {
  registerForPushNotificationsAsync().catch(() => {
    // Permission denied or simulator — silent ok.
  })
}

interface AuthState {
  user: UsersRow | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
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
  // 1. Try to use the first real user in the users table who has a ward assigned.
  //    This gives us a real ward UUID so all ward-filtered queries work correctly.
  const { data: anyUser } = await supabase
    .from('users')
    .select('id, email, name, phone, role, ward_id, created_at')
    .not('ward_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (anyUser) return anyUser as UsersRow

  // 2. No user row readable — get the first ward UUID from the wards table.
  const { data: ward } = await supabase
    .from('wards')
    .select('id')
    .limit(1)
    .maybeSingle()

  // Return the local bypass identity with a real ward UUID (or null if DB is empty).
  return { ...DEV_BYPASS_USER, ward_id: ward?.id ?? null }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    if (isDevAuthBypassActive) {
      const user = await ensureBypassUser()
      set({ user, session: null, loading: false })
      attemptPushRegistration()
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
    if (user) attemptPushRegistration()
  },

  signInWithGoogle: async () => {
    const redirectTo = Linking.createURL('/auth-callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error) throw error
    if (!data?.url) throw new Error('Could not start Google sign-in')

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success' || !result.url) {
      throw new Error('Sign-in cancelled')
    }

    const url = new URL(result.url)
    const params = new URLSearchParams(url.hash ? url.hash.slice(1) : url.search)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) {
      throw new Error('Missing tokens from Google response')
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })
    if (sessionError) throw sessionError

    const authedUser = sessionData.user ? await fetchUser(sessionData.user.id) : null
    if (sessionData.user && !authedUser) {
      await supabase.auth.signOut()
      throw new Error('No matching user profile found')
    }
    set({ user: authedUser, session: sessionData.session })
    if (authedUser) attemptPushRegistration()
  },

  signInWithApple: async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS')
    }
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      throw new Error('Apple Sign-In is not available on this device')
    }

    const rawNonce = Array.from(Crypto.getRandomBytes(16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    )

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })
    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token')
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    })
    if (error) throw error

    const authedUser = data.user ? await fetchUser(data.user.id) : null
    if (data.user && !authedUser) {
      await supabase.auth.signOut()
      throw new Error('No matching user profile found')
    }
    set({ user: authedUser, session: data.session })
    if (authedUser) attemptPushRegistration()
  },

  resetPassword: async (email: string) => {
    if (isDevAuthBypassActive) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  },

  signOut: async () => {
    if (isDevAuthBypassActive) {
      const user = await ensureBypassUser()
      set({ user, session: null, loading: false })
      return
    }

    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null, session: null })
  },

  initialize: () => {
    if (isDevAuthBypassActive) {
      ensureBypassUser()
        .then((user) => {
          set({ user, session: null, loading: false })
          attemptPushRegistration()
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
        attemptPushRegistration()
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
