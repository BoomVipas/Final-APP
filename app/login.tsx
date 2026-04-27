/**
 * app/login.tsx
 * Login screen for PILLo Caregiver App.
 */

import React, { useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as AppleAuthentication from 'expo-apple-authentication'
import Svg, { Path } from 'react-native-svg'
import { useAuthStore } from '../src/stores/authStore'
import { Button } from '../src/components/ui/Button'

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  )
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M16.365 1.43c0 1.14-.43 2.21-1.18 3-.85.86-2.07 1.49-3.07 1.42-.13-1.16.45-2.34 1.16-3.06.79-.84 2.16-1.46 3.09-1.36zM20.5 17.27c-.55 1.27-.81 1.83-1.51 2.95-.98 1.55-2.36 3.49-4.07 3.5-1.52.02-1.91-.99-3.96-.98-2.05.01-2.49 1-4.01.98-1.71-.02-3.02-1.76-4-3.31-2.74-4.34-3.03-9.43-1.34-12.14 1.2-1.92 3.09-3.04 4.86-3.04 1.81 0 2.94.99 4.43.99 1.45 0 2.34-1 4.43-1 1.58 0 3.25.86 4.44 2.34-3.9 2.14-3.27 7.71.74 9.71z"
      />
    </Svg>
  )
}

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithApple, resetPassword } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [appleAvailable, setAppleAvailable] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false))
  }, [])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (emailError) setEmailError(null)
    if (loginError) setLoginError(null)
    if (resetMessage) setResetMessage(null)
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (loginError) setLoginError(null)
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter your email and password')
      return
    }

    setLoading(true)
    setLoginError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      const isInvalidCreds = /invalid login credentials|invalid email or password/i.test(raw)
      const message = isInvalidCreds || !raw
        ? 'Invalid email or password'
        : raw
      setLoginError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setOauthLoading('google')
    setLoginError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed'
      if (!/cancelled/i.test(message)) setLoginError(message)
    } finally {
      setOauthLoading(null)
    }
  }

  const handleApple = async () => {
    setOauthLoading('apple')
    setLoginError(null)
    try {
      await signInWithApple()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Apple sign-in failed'
      const isUserCancel = /canceled|cancelled|ERR_REQUEST_CANCELED/i.test(message)
      if (!isUserCancel) setLoginError(message)
    } finally {
      setOauthLoading(null)
    }
  }

  const handleForgotPassword = async () => {
    setResetMessage(null)
    setLoginError(null)
    if (!email.trim()) {
      setEmailError('Please enter your email first')
      return
    }
    setEmailError(null)
    setResetting(true)
    try {
      await resetPassword(email.trim())
      setResetMessage('Reset link sent to your email')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset link'
      Alert.alert('Reset failed', message)
    } finally {
      setResetting(false)
    }
  }

  const anyLoading = loading || oauthLoading !== null

  return (
    <SafeAreaView className="flex-1 bg-[#F6EFE6]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 px-5 pt-4 pb-6 justify-between">
          <View>
            <View className="w-28 h-28 rounded-full bg-[#EAC59F] absolute -top-8 -right-8 opacity-70" />
            <View className="w-20 h-20 rounded-full bg-[#D97A28] absolute top-20 -left-6 opacity-20" />

            <View className="pt-8">
              <View className="self-start px-4 py-2 rounded-full bg-[#FFF4E8] border border-[#E9CFB1] mb-5">
                <Text className="text-xs font-semibold tracking-wide text-[#8E4B14]">
                  PILLo CAREGIVER
                </Text>
              </View>

              <Text className="text-[34px] leading-[40px] font-bold text-[#2E241B]">
                Medication and care
              </Text>
              <Text className="text-[34px] leading-[40px] font-bold text-[#2E241B]">
                in one place
              </Text>
              <Text className="text-base leading-6 text-[#6F6254] mt-4 max-w-[320px]">
                Track patients, schedules, and shift handovers on a screen built for clinical use.
              </Text>
            </View>
          </View>

          <View className="bg-[#FFF9F2] rounded-[32px] border border-[#EADBCB] px-5 py-6">
            <Text className="text-xl font-bold text-[#2E241B] mb-5">Sign in</Text>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-[#5E5145] mb-2">Email</Text>
              <TextInput
                value={email}
                onChangeText={handleEmailChange}
                placeholder="nurse@hospital.com"
                placeholderTextColor="#A79A8D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!anyLoading}
                className="bg-[#F7F1E8] border border-[#E7D8C7] rounded-[22px] px-4 min-h-[54px] text-sm text-[#2E241B]"
              />
              {emailError ? (
                <Text className="text-xs text-[#FF6A63] mt-2 ml-1">{emailError}</Text>
              ) : null}
            </View>

            <View className="mb-1">
              <Text className="text-sm font-semibold text-[#5E5145] mb-2">Password</Text>
              <TextInput
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="••••••••"
                placeholderTextColor="#A79A8D"
                secureTextEntry
                autoComplete="password"
                editable={!anyLoading}
                className="bg-[#F7F1E8] border border-[#E7D8C7] rounded-[22px] px-4 min-h-[54px] text-sm text-[#2E241B]"
              />
              {loginError ? (
                <Text className="text-xs text-[#FF6A63] mt-2 ml-1">{loginError}</Text>
              ) : null}
              {resetMessage ? (
                <Text className="text-xs text-[#8E4B14] mt-2 ml-1">{resetMessage}</Text>
              ) : null}
            </View>

            <View className="flex-row justify-end mb-3">
              <Pressable
                onPress={handleForgotPassword}
                disabled={resetting || anyLoading}
                hitSlop={12}
                className="min-h-[48px] justify-center px-2"
              >
                <Text className="text-xs font-semibold text-[#C96B1A]">
                  {resetting ? 'Sending...' : 'Forgot password?'}
                </Text>
              </Pressable>
            </View>

            <Button
              title="Sign in"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={anyLoading}
            />

            <View className="flex-row items-center my-5">
              <View className="flex-1 h-px bg-[#EADBCB]" />
              <Text className="mx-3 text-xs font-medium text-[#A79A8D]">OR</Text>
              <View className="flex-1 h-px bg-[#EADBCB]" />
            </View>

            <Pressable
              onPress={handleGoogle}
              disabled={anyLoading}
              className="flex-row items-center justify-center bg-white border border-[#E7D8C7] rounded-[22px] min-h-[54px] mb-3"
              style={{ opacity: anyLoading ? 0.6 : 1 }}
            >
              <View className="mr-3">
                <GoogleIcon />
              </View>
              <Text className="text-sm font-semibold text-[#2E241B]">
                {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
              </Text>
            </Pressable>

            {Platform.OS === 'ios' && appleAvailable ? (
              <Pressable
                onPress={handleApple}
                disabled={anyLoading}
                className="flex-row items-center justify-center bg-black rounded-[22px] min-h-[54px]"
                style={{ opacity: anyLoading ? 0.6 : 1 }}
              >
                <View className="mr-3">
                  <AppleIcon />
                </View>
                <Text className="text-sm font-semibold text-white">
                  {oauthLoading === 'apple' ? 'Connecting...' : 'Continue with Apple'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
