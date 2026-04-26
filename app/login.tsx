/**
 * app/login.tsx
 * Login screen for PILLo Caregiver App.
 */

import React, { useState } from 'react'
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
import { useAuthStore } from '../src/stores/authStore'
import { Button } from '../src/components/ui/Button'
import { USE_MOCK } from '../src/mocks'

export default function LoginScreen() {
  const { signIn, resetPassword } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

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
      setLoginError('กรุณากรอกอีเมลและรหัสผ่าน / Please enter email and password')
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
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง / Invalid email or password'
        : raw
      setLoginError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setResetMessage(null)
    setLoginError(null)
    if (!email.trim()) {
      setEmailError('กรุณากรอกอีเมลก่อน / Please enter your email first')
      return
    }
    setEmailError(null)
    setResetting(true)
    try {
      await resetPassword(email.trim())
      setResetMessage('ลิงก์รีเซ็ตรหัสผ่านส่งไปที่อีเมลแล้ว / Reset link sent to your email')
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'ส่งลิงก์รีเซ็ตไม่สำเร็จ / Failed to send reset link'
      Alert.alert('รีเซ็ตรหัสผ่านไม่สำเร็จ / Reset failed', message)
    } finally {
      setResetting(false)
    }
  }

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
                จัดการยาและงานดูแล
              </Text>
              <Text className="text-[34px] leading-[40px] font-bold text-[#2E241B]">
                ในที่เดียว
              </Text>
              <Text className="text-base leading-6 text-[#6F6254] mt-4 max-w-[320px]">
                ติดตามผู้ป่วย ตารางยา และการส่งต่องานด้วยหน้าจอที่อ่านง่ายและพร้อมใช้งานระหว่างกะ
              </Text>
            </View>
          </View>

          <View className="bg-[#FFF9F2] rounded-[32px] border border-[#EADBCB] px-5 py-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-xl font-bold text-[#2E241B]">เข้าสู่ระบบ</Text>
              <View className={`px-3 py-1 rounded-full ${USE_MOCK ? 'bg-[#EFE7DD]' : 'bg-[#E4F2E6]'}`}>
                <Text className={`text-[11px] font-semibold ${USE_MOCK ? 'text-[#6F6254]' : 'text-[#2F6B55]'}`}>
                  {USE_MOCK ? 'DEMO MODE' : 'LIVE BACKEND'}
                </Text>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-semibold text-[#5E5145] mb-2">อีเมล / Email</Text>
              <TextInput
                value={email}
                onChangeText={handleEmailChange}
                placeholder="nurse@hospital.th"
                placeholderTextColor="#A79A8D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                className="bg-[#F7F1E8] border border-[#E7D8C7] rounded-[22px] px-4 min-h-[54px] text-sm text-[#2E241B]"
              />
              {emailError ? (
                <Text className="text-xs text-[#FF6A63] mt-2 ml-1">{emailError}</Text>
              ) : null}
            </View>

            <View className="mb-1">
              <Text className="text-sm font-semibold text-[#5E5145] mb-2">รหัสผ่าน / Password</Text>
              <TextInput
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="••••••••"
                placeholderTextColor="#A79A8D"
                secureTextEntry
                autoComplete="password"
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
                disabled={resetting}
                hitSlop={12}
                className="min-h-[48px] justify-center px-2"
              >
                <Text className="text-xs font-semibold text-[#F2A24B]">
                  {resetting
                    ? 'กำลังส่ง... / Sending...'
                    : 'ลืมรหัสผ่าน? / Forgot Password?'}
                </Text>
              </Pressable>
            </View>

            <Text className="text-xs text-[#8C8174] mb-5">
              {USE_MOCK
                ? 'กำลังใช้งานข้อมูลตัวอย่างในเครื่อง'
                : 'เชื่อมต่อ Supabase พร้อมสำหรับข้อมูลจริง'}
            </Text>

            <Button
              title="เข้าสู่ระบบ"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
