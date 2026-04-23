/**
 * app/add-medication.tsx
 * Minimal handoff destination for the patient detail CTA.
 */

import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'

export default function AddMedicationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientName = typeof params.patientName === 'string' ? params.patientName : 'Patient'

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F2EA' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#F9E1BE', '#F5BC77', '#ECA44E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 36 }}
      >
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
            <View style={{ position: 'relative', minHeight: 44, justifyContent: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={28} color="#2F2E2D" />
              </TouchableOpacity>

              <Text
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  fontSize: 18,
                  lineHeight: 24,
                  fontWeight: '600',
                  color: '#2F2E2D',
                }}
              >
                Add Medication
              </Text>
            </View>

            <Text
              style={{
                marginTop: 28,
                fontSize: 28,
                lineHeight: 34,
                fontWeight: '700',
                color: '#2F2E2D',
              }}
            >
              {patientName}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 16, lineHeight: 22, color: '#4F4B47' }}>
              Medication setup will be connected here for the selected patient.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={{ paddingHorizontal: 18, marginTop: 18 }}>
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingVertical: 22,
            shadowColor: '#D7CCBB',
            shadowOpacity: 0.22,
            shadowOffset: { width: 0, height: 14 },
            shadowRadius: 26,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: '#FFF4E2',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Ionicons name="medkit-outline" size={24} color="#EFA247" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D' }}>
                Intake route ready
              </Text>
              <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, color: '#727C8F' }}>
                The CTA from patient detail now lands on its own route instead of a dead end.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
