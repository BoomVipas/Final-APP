/**
 * app/dispense-fill/[patientId]/load.tsx
 *
 * Stage 1 of the per-patient weekly cabinet-fill workflow (Workflow 18 D3).
 * Mirrors the web's /ward/patients/addToDispenser page:
 *   - Home machine, move tray to fill position 1
 *   - Caregiver loads each medicine into a slot, taps the active card to advance
 *   - When all loaded, "Start Dispense" creates session + slot rows + dispense items
 *     and routes to the run screen.
 */

import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { supabase } from '../../../src/lib/supabase'
import {
  getMachineStatus,
  homeAllAxes,
  moveBayToFill,
} from '../../../src/lib/moonraker'
import {
  createDispenseSession,
  upsertDispenserSlot,
  confirmDispenserSlot,
  generateDispenseItems,
} from '../../../src/lib/dispenseFill'
import { useAuthStore } from '../../../src/stores/authStore'
import { USE_MOCK, MOCK_MEDICINES } from '../../../src/mocks'
import type { MealTime, MedicinesRow } from '../../../src/types/database'

const MAX_SLOTS = 8

interface LoadMedicine {
  prescriptionId: string
  medicineId: string
  name: string
  strength: string
  doseQuantity: number
  mealTimes: MealTime[]
}

const MEAL_LABELS: Record<MealTime, string> = {
  morning: 'Morning',
  noon: 'Noon',
  evening: 'Evening',
  bedtime: 'Bedtime',
}

type MachineState = 'checking' | 'homing' | 'ready' | 'moving' | 'offline' | 'error'

export default function CabinetLoadScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientId = typeof params.patientId === 'string' ? params.patientId : ''
  const patientName = typeof params.patientName === 'string' ? params.patientName : 'Patient'
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [medicines, setMedicines] = useState<LoadMedicine[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [filledSlots, setFilledSlots] = useState<Set<string>>(new Set())
  const [machineState, setMachineState] = useState<MachineState>('checking')
  const [machineMessage, setMachineMessage] = useState<string>('')
  const [starting, setStarting] = useState(false)
  const didInit = useRef(false)

  // ── Load prescriptions ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) {
      setLoading(false)
      return
    }
    let active = true

    const load = async () => {
      try {
        if (USE_MOCK) {
          // Mock: 3 medicines from MOCK_MEDICINES with realistic meal_times
          const mocked: LoadMedicine[] = MOCK_MEDICINES.slice(0, 3).map((med, i) => ({
            prescriptionId: `mock-rx-${med.id}`,
            medicineId: med.id,
            name: med.name,
            strength: med.strength ?? '',
            doseQuantity: 1,
            mealTimes:
              i === 0 ? ['morning']
              : i === 1 ? ['morning', 'noon']
              : ['evening', 'bedtime'],
          }))
          if (active) setMedicines(mocked)
          return
        }

        const { data, error } = await supabase
          .from('patient_prescriptions')
          .select('id, medicine_id, dose_quantity, meal_times, medicines(id, name, strength)')
          .eq('patient_id', patientId)
          .eq('is_active', true)
        if (error) throw error

        const list: LoadMedicine[] = (data ?? []).map((row) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = row as any
          const med = r.medicines as Pick<MedicinesRow, 'id' | 'name' | 'strength'> | null
          return {
            prescriptionId: r.id,
            medicineId: r.medicine_id,
            name: med?.name ?? 'Unknown medicine',
            strength: med?.strength ?? '',
            doseQuantity: r.dose_quantity ?? 1,
            mealTimes: (r.meal_times ?? []) as MealTime[],
          }
        })
        if (active) setMedicines(list)
      } catch (err) {
        console.error('Failed to load prescriptions:', err)
        if (active) setMedicines([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [patientId])

  // ── Initialise the machine (home + move to slot 1) ─────────────────────────
  useEffect(() => {
    if (didInit.current) return
    if (loading || medicines.length === 0) return
    didInit.current = true

    const initMachine = async () => {
      if (USE_MOCK) {
        setMachineState('homing')
        setMachineMessage('Mock: homing machine…')
        await new Promise((r) => setTimeout(r, 600))
        setMachineState('ready')
        setMachineMessage('Mock: tray at slot 1')
        return
      }

      setMachineState('checking')
      const status = await getMachineStatus()
      if (status.state === 'unreachable') {
        setMachineState('offline')
        setMachineMessage(status.message)
        return
      }
      if (status.state !== 'ready') {
        setMachineState('error')
        setMachineMessage(`Machine not ready (${status.state}): ${status.message}`)
        return
      }

      try {
        setMachineState('homing')
        setMachineMessage('Homing all axes…')
        await homeAllAxes()
        setMachineMessage('Moving tray to slot 1…')
        await moveBayToFill(1)
        setMachineState('ready')
        setMachineMessage('Tray at slot 1 — load the first medicine')
      } catch (err) {
        setMachineState('error')
        setMachineMessage(err instanceof Error ? err.message : 'Hardware init failed')
      }
    }
    initMachine()
  }, [loading, medicines.length])

  // ── Tap an active card → confirm + move tray to next slot ──────────────────
  const handleCardTap = async (med: LoadMedicine, index: number) => {
    if (index !== currentIndex) return
    if (machineState === 'moving' || machineState === 'homing' || machineState === 'checking') return
    if (filledSlots.has(med.prescriptionId)) return

    const nextIndex = index + 1
    const nextSlotPosition = nextIndex + 1 // slots are 1-based

    setFilledSlots((prev) => {
      const next = new Set(prev)
      next.add(med.prescriptionId)
      return next
    })

    if (nextIndex >= medicines.length) {
      setCurrentIndex(nextIndex)
      setMachineMessage('All medicines loaded — ready to start')
      return
    }

    if (nextSlotPosition > MAX_SLOTS) {
      setCurrentIndex(nextIndex)
      setMachineMessage(`Cabinet has only ${MAX_SLOTS} slots — extra medicines logged but not loaded`)
      return
    }

    if (USE_MOCK) {
      setMachineState('moving')
      setMachineMessage(`Mock: moving to slot ${nextSlotPosition}…`)
      await new Promise((r) => setTimeout(r, 600))
      setCurrentIndex(nextIndex)
      setMachineState('ready')
      setMachineMessage(`Mock: tray at slot ${nextSlotPosition}`)
      return
    }

    try {
      setMachineState('moving')
      setMachineMessage(`Moving tray to slot ${nextSlotPosition}…`)
      await moveBayToFill(nextSlotPosition)
      setCurrentIndex(nextIndex)
      setMachineState('ready')
      setMachineMessage(`Tray at slot ${nextSlotPosition} — load the next medicine`)
    } catch (err) {
      setMachineState('error')
      setMachineMessage(err instanceof Error ? err.message : 'Move failed')
    }
  }

  // ── Caregiver presses "Start Dispense" ─────────────────────────────────────
  const allLoaded = medicines.length > 0 && filledSlots.size === medicines.length
  const canStart = allLoaded && machineState !== 'moving' && machineState !== 'homing' && !starting

  const handleStartDispense = async () => {
    if (!canStart) return
    if (!user?.ward_id && !USE_MOCK) {
      Alert.alert('No ward', 'Cannot start dispense — your account is not assigned to a ward.')
      return
    }
    setStarting(true)
    try {
      const sessionId = await createSessionAndItems()
      router.replace({
        pathname: '/dispense-fill/run/[sessionId]',
        params: { sessionId, patientId, patientName },
      })
    } catch (err) {
      Alert.alert('Could not start dispense', err instanceof Error ? err.message : 'Unknown error')
      setStarting(false)
    }
  }

  const createSessionAndItems = async (): Promise<string> => {
    const wardId = user?.ward_id ?? ''
    const { session_id } = await createDispenseSession(patientId, wardId)

    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i]
      const slotIndex = i + 1
      if (slotIndex > MAX_SLOTS) break
      await upsertDispenserSlot(
        session_id,
        slotIndex,
        med.medicineId,
        patientId,
        med.doseQuantity,
        med.mealTimes,
      )
      await confirmDispenserSlot(session_id, slotIndex)
    }

    await generateDispenseItems(session_id)

    // Sync loaded slot positions to cabinet_slots so the ward screen's per-meal
    // dispense (Flow A) reads current bay assignments after a weekly fill.
    if (!USE_MOCK) {
      const cabinetUpserts = medicines.slice(0, MAX_SLOTS).map((med, i) => ({
        medicine_id: med.medicineId,
        cabinet_position: i + 1,
        quantity_remaining: 100,
        initial_quantity: 100,
        partition: 'A',
      }))
      await supabase.from('cabinet_slots').upsert(cabinetUpserts, { onConflict: 'medicine_id' })
      // Intentionally not checking error — cabinet_slots sync is best-effort
    }

    return session_id
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#C96B1A" />
        <Text className="text-sm text-[#7D6E60] mt-3">Loading prescriptions…</Text>
      </SafeAreaView>
    )
  }

  if (medicines.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl mb-4">📭</Text>
          <Text className="text-xl font-bold text-[#2E241B] text-center mb-2">
            No active prescriptions
          </Text>
          <Text className="text-sm text-[#7D6E60] text-center mb-8">
            Add medications for {patientName} before loading the cabinet.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-[#C96B1A] rounded-2xl px-8 py-3"
          >
            <Text className="text-white font-bold text-base">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View className="flex-1 bg-[#F7F2EA]">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        {/* Header */}
        <View className="px-5 pt-3 pb-3 flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2">
            <Ionicons name="chevron-back" size={26} color="#313131" />
          </Pressable>
          <View className="flex-1 ml-1">
            <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#8E4B14]">
              Weekly Fill — Stage 1
            </Text>
            <Text className="text-[20px] leading-[26px] font-bold text-[#2E241B] mt-0.5" numberOfLines={1}>
              Load {patientName}&apos;s cabinet
            </Text>
          </View>
        </View>

        {/* Machine status banner */}
        <MachineBanner state={machineState} message={machineMessage} />

        {/* Progress dots */}
        <View className="px-5 mt-3 mb-2 flex-row items-center">
          {medicines.map((_, i) => {
            const isFilled = i < currentIndex || filledSlots.has(medicines[i].prescriptionId)
            const isActive = i === currentIndex && !isFilled
            return (
              <View
                key={i}
                className="h-2 flex-1 mr-1.5 rounded-full"
                style={{
                  backgroundColor: isFilled ? '#18B88E' : isActive ? '#C96B1A' : '#E4DDD0',
                }}
              />
            )
          })}
          <Text className="ml-2 text-xs text-[#7D6E60]">
            {Math.min(filledSlots.size, medicines.length)}/{medicines.length}
          </Text>
        </View>

        {/* Card list */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {medicines.map((med, index) => {
            const isFilled = filledSlots.has(med.prescriptionId)
            const isActive = !isFilled && index === currentIndex
            const isLocked = !isFilled && index > currentIndex

            return (
              <MedicineCard
                key={med.prescriptionId}
                slotPosition={index + 1}
                med={med}
                state={isFilled ? 'filled' : isActive ? 'active' : 'locked'}
                disabled={isLocked || isFilled || machineState === 'moving' || machineState === 'homing'}
                onTap={() => handleCardTap(med, index)}
              />
            )
          })}
        </ScrollView>

        {/* Footer CTA */}
        <View className="px-4 pb-6 pt-3 bg-[#F7F2EA] border-t border-[#EADBCB]">
          <TouchableOpacity
            onPress={handleStartDispense}
            disabled={!canStart}
            activeOpacity={0.85}
            className={`rounded-[22px] py-4 items-center flex-row justify-center ${
              canStart ? 'bg-[#C96B1A]' : 'bg-[#E8D5C4]'
            }`}
          >
            {starting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  {allLoaded ? 'Start Dispense' : `Load ${medicines.length - filledSlots.size} more medicine(s)`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MachineBanner({ state, message }: { state: MachineState; message: string }) {
  const tone =
    state === 'ready' ? { bg: '#E3FCEA', border: '#BDEFE3', text: '#1B8C67', dot: '#18B88E' }
    : state === 'offline' ? { bg: '#FEF1E6', border: '#F4D6B5', text: '#8E4B14', dot: '#E08830' }
    : state === 'error' ? { bg: '#FDECED', border: '#F5C5C7', text: '#A3322A', dot: '#F26666' }
    : { bg: '#EAF2FB', border: '#CDE0F5', text: '#2A5C9C', dot: '#4D8DD7' }

  const icon =
    state === 'ready' ? 'checkmark-circle'
    : state === 'offline' ? 'cloud-offline-outline'
    : state === 'error' ? 'alert-circle'
    : 'sync'

  return (
    <View
      className="mx-4 px-3 py-2.5 rounded-2xl border flex-row items-center"
      style={{ backgroundColor: tone.bg, borderColor: tone.border }}
    >
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={tone.text} />
      <Text className="ml-2 text-[12px] font-semibold flex-1" style={{ color: tone.text }} numberOfLines={2}>
        {message || 'Initialising…'}
      </Text>
    </View>
  )
}

function MedicineCard({
  slotPosition,
  med,
  state,
  disabled,
  onTap,
}: {
  slotPosition: number
  med: LoadMedicine
  state: 'locked' | 'active' | 'filled'
  disabled: boolean
  onTap: () => void
}) {
  const cardStyle =
    state === 'filled' ? { backgroundColor: '#E3FCEA', borderColor: '#A8E5C9' }
    : state === 'active' ? { backgroundColor: '#FFFFFF', borderColor: '#C96B1A' }
    : { backgroundColor: '#F4EFE5', borderColor: '#E4DDD0' }

  const slotBadgeStyle =
    state === 'filled' ? { backgroundColor: '#18B88E' }
    : state === 'active' ? { backgroundColor: '#C96B1A' }
    : { backgroundColor: '#C7BFAF' }

  const pillsPerWeek = med.doseQuantity * med.mealTimes.length * 7

  return (
    <TouchableOpacity
      onPress={onTap}
      disabled={disabled}
      activeOpacity={state === 'active' ? 0.85 : 1}
      className="rounded-2xl border-2 px-4 py-4 mb-3 flex-row items-start"
      style={cardStyle}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center mr-3"
        style={slotBadgeStyle}
      >
        {state === 'filled' ? (
          <Ionicons name="checkmark" size={22} color="white" />
        ) : (
          <Text className="text-white font-bold text-base">{slotPosition}</Text>
        )}
      </View>

      <View className="flex-1 pr-2">
        <Text className="text-[15px] font-bold text-[#2E241B]" numberOfLines={1}>
          {med.name}
        </Text>
        {med.strength ? (
          <Text className="text-[12px] text-[#7D6E60] mt-0.5">{med.strength}</Text>
        ) : null}
        <View className="flex-row flex-wrap mt-2">
          {med.mealTimes.map((m) => (
            <View
              key={m}
              className="px-2 py-0.5 rounded-full bg-[#FFF1DD] border border-[#EADBCB] mr-1.5 mb-1"
            >
              <Text className="text-[10px] text-[#8E4B14] font-medium">{MEAL_LABELS[m]}</Text>
            </View>
          ))}
        </View>
        <Text className="text-[11px] text-[#7D6E60] mt-1">{pillsPerWeek} pills / week</Text>
      </View>

      {state === 'active' ? (
        <View className="bg-[#C96B1A] rounded-full px-3 py-1.5">
          <Text className="text-white text-xs font-bold">Tap when loaded</Text>
        </View>
      ) : state === 'filled' ? (
        <View className="bg-[#18B88E] rounded-full px-3 py-1.5">
          <Text className="text-white text-xs font-bold">Loaded</Text>
        </View>
      ) : (
        <View className="bg-[#C7BFAF] rounded-full px-3 py-1.5">
          <Text className="text-white text-xs font-bold">Locked</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
