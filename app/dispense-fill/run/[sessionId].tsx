/**
 * app/dispense-fill/[sessionId]/run.tsx
 *
 * Stage 2 of the per-patient weekly cabinet-fill workflow (Workflow 18 D4).
 * Mirrors the web's /ward/patients/addToDispenser/schedule page.
 *
 * Iterates a 7-day × N-meal grid (N = number of active meal_times across all
 * loaded slots). For each (day, meal) cell, calls runDispenseSequence with the
 * slot indices that include that meal. First cell homes; subsequent cells pass
 * startY to skip the re-home.
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

import {
  runDispenseSequence,
  emergencyStop,
  type DispenseProgressEvent,
} from '../../../src/lib/moonraker'
import { updateSessionStatus } from '../../../src/lib/dispenseFill'
import { supabase } from '../../../src/lib/supabase'
import { USE_MOCK } from '../../../src/mocks'
import type { DispenserSlotsRow, MealTime } from '../../../src/types/database'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const MEAL_ORDER: MealTime[] = ['morning', 'noon', 'evening', 'bedtime']
const MEAL_LABELS: Record<MealTime, { label: string; time: string }> = {
  morning: { label: 'Morning', time: '08:00' },
  noon: { label: 'Noon', time: '12:00' },
  evening: { label: 'Evening', time: '18:00' },
  bedtime: { label: 'Bedtime', time: '21:00' },
}

type CellStatus = 'waiting' | 'dispensing' | 'done'

const cellKey = (day: number, mealIdx: number) => `${day}-${mealIdx}`

interface MockSlot {
  slot_index: number
  medicine_id: string
  meal_times: MealTime[]
  dose_quantity: number
  medicineName?: string
}

const MOCK_SLOTS: MockSlot[] = [
  { slot_index: 1, medicine_id: 'mock-med-001', meal_times: ['morning'],          dose_quantity: 1, medicineName: 'แอมโลดิปีน 5mg' },
  { slot_index: 2, medicine_id: 'mock-med-002', meal_times: ['morning', 'noon'],  dose_quantity: 1, medicineName: 'เมทฟอร์มิน 500mg' },
  { slot_index: 3, medicine_id: 'mock-med-003', meal_times: ['evening', 'bedtime'], dose_quantity: 1, medicineName: 'แอสไพริน 81mg' },
]

export default function DispenseRunScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ sessionId?: string; patientId?: string; patientName?: string }>()
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
  const patientName = typeof params.patientName === 'string' ? params.patientName : 'Patient'
  const isMockSession = sessionId.startsWith('mock-session-')

  const [loading, setLoading] = useState(true)
  const [slots, setSlots] = useState<Pick<DispenserSlotsRow, 'slot_index' | 'medicine_id' | 'meal_times' | 'dose_quantity'>[]>([])
  const [activeMeals, setActiveMeals] = useState<MealTime[]>([])
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({})
  const [viewDayIndex, setViewDayIndex] = useState(0)
  const [events, setEvents] = useState<DispenseProgressEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [completed, setCompleted] = useState(false)
  const lastYRef = useRef<number | undefined>(undefined)
  const eventsScrollRef = useRef<ScrollView>(null)
  const didInit = useRef(false)
  const dispatchedKeyRef = useRef<string | null>(null)

  // ── Load session slots ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        if (USE_MOCK || isMockSession) {
          if (active) setSlots(MOCK_SLOTS)
          return
        }
        const { data, error } = await supabase
          .from('dispenser_slots')
          .select('slot_index, medicine_id, meal_times, dose_quantity')
          .eq('session_id', sessionId)
          .order('slot_index')
        if (error) throw error
        if (active) setSlots((data ?? []) as unknown as DispenserSlotsRow[])
      } catch (err) {
        console.error('Failed to load dispenser slots:', err)
        if (active) setSlots([])
      } finally {
        if (active) setLoading(false)
      }
    }
    if (sessionId) load()
    else setLoading(false)
    return () => { active = false }
  }, [sessionId, isMockSession])

  // ── Derive active meals + initial cell statuses ────────────────────────────
  useEffect(() => {
    if (slots.length === 0) return
    const meals = MEAL_ORDER.filter((m) => slots.some((s) => s.meal_times.includes(m)))
    setActiveMeals(meals)
    const init: Record<string, CellStatus> = {}
    for (let d = 0; d < DAYS.length; d++) {
      for (let m = 0; m < meals.length; m++) {
        init[cellKey(d, m)] = d === 0 && m === 0 ? 'dispensing' : 'waiting'
      }
    }
    setCellStatuses(init)
  }, [slots])

  // ── Kick the first dispenseSequence once data + meals are ready ───────────
  useEffect(() => {
    if (didInit.current) return
    if (loading || slots.length === 0 || activeMeals.length === 0) return
    didInit.current = true
    runForCell(0, 0, true)
  }, [loading, slots, activeMeals])

  const slotIndicesForMeal = (mealKey: MealTime): number[] => {
    return slots
      .filter((s) => s.meal_times.includes(mealKey))
      .map((s) => s.slot_index)
      .sort((a, b) => a - b)
  }

  const onProgress = (event: DispenseProgressEvent) => {
    setEvents((prev) => {
      const next = [...prev, event]
      requestAnimationFrame(() => eventsScrollRef.current?.scrollToEnd({ animated: true }))
      return next
    })
  }

  const runForCell = async (day: number, mealIdx: number, isFirst: boolean) => {
    const key = cellKey(day, mealIdx)
    if (dispatchedKeyRef.current === key) return // guard double-fire
    dispatchedKeyRef.current = key

    const mealKey = activeMeals[mealIdx]
    const indices = slotIndicesForMeal(mealKey)
    if (indices.length === 0) {
      // Nothing to do — auto-mark done and advance
      setCellStatuses((prev) => ({ ...prev, [key]: 'done' }))
      advanceFrom(day, mealIdx)
      return
    }

    const cabinets = indices.map((idx) => {
      const slot = slots.find((s) => s.slot_index === idx)
      return {
        cabinet: idx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patientName: ((slot as any)?.medicineName as string | undefined) ?? `Slot ${idx}`,
      }
    })

    setBusy(true)
    try {
      if (USE_MOCK || isMockSession) {
        onProgress({ type: 'homing', message: isFirst ? 'Mock: homing all axes…' : 'Mock: continuing from last position' })
        for (let i = 0; i < cabinets.length; i++) {
          const c = cabinets[i]
          await new Promise((r) => setTimeout(r, 400))
          onProgress({ type: 'moving', cabinet: c.cabinet, step: i + 1, total: cabinets.length, message: `Mock: moving to slot ${c.cabinet}` })
          await new Promise((r) => setTimeout(r, 300))
          onProgress({ type: 'picking', cabinet: c.cabinet, step: i + 1, total: cabinets.length, message: `Mock: picking from slot ${c.cabinet}` })
          await new Promise((r) => setTimeout(r, 300))
          onProgress({ type: 'delivering', cabinet: c.cabinet, step: i + 1, total: cabinets.length, message: `✓ Mock dispensed slot ${c.cabinet}` })
        }
        onProgress({ type: 'done', message: 'Mock: cell complete — caregiver may continue' })
        lastYRef.current = (lastYRef.current ?? 0) + 100
      } else {
        const finalY = await runDispenseSequence(cabinets, onProgress, isFirst ? undefined : lastYRef.current)
        lastYRef.current = finalY
      }
    } catch (err) {
      onProgress({ type: 'error', message: err instanceof Error ? err.message : 'Dispense failed' })
      setStopped(true)
    } finally {
      setBusy(false)
    }
  }

  const advanceFrom = (day: number, mealIdx: number) => {
    let nextD = day
    let nextM = mealIdx + 1
    if (nextM >= activeMeals.length) {
      nextD += 1
      nextM = 0
    }
    if (nextD >= DAYS.length) {
      finishSession()
      return
    }
    setCellStatuses((prev) => ({ ...prev, [cellKey(nextD, nextM)]: 'dispensing' }))
    setViewDayIndex(nextD)
    runForCell(nextD, nextM, false)
  }

  const handleReady = () => {
    if (busy || stopped) return
    const active = findActive()
    if (!active) return
    setCellStatuses((prev) => ({ ...prev, [cellKey(active.d, active.m)]: 'done' }))
    advanceFrom(active.d, active.m)
  }

  const findActive = (): { d: number; m: number } | null => {
    for (let d = 0; d < DAYS.length; d++) {
      for (let m = 0; m < activeMeals.length; m++) {
        if (cellStatuses[cellKey(d, m)] === 'dispensing') return { d, m }
      }
    }
    return null
  }

  const finishSession = async () => {
    setCompleted(true)
    try {
      if (!isMockSession && !USE_MOCK) {
        await updateSessionStatus(sessionId, 'completed')
      }
    } catch (err) {
      console.error('Failed to mark session completed:', err)
    }
    router.replace({
      pathname: '/dispense-fill/complete/[sessionId]',
      params: { sessionId, patientName },
    })
  }

  const handleEmergencyStop = async () => {
    Alert.alert(
      '🛑 Emergency Stop',
      'This will halt the dispenser immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'STOP',
          style: 'destructive',
          onPress: async () => {
            setStopped(true)
            try {
              if (!USE_MOCK && !isMockSession) await emergencyStop()
              try { await updateSessionStatus(sessionId, 'failed') } catch { /* ignore */ }
              onProgress({ type: 'error', message: 'Emergency stop triggered' })
            } catch (err) {
              onProgress({ type: 'error', message: err instanceof Error ? err.message : 'Stop failed' })
            }
          },
        },
      ],
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#C96B1A" />
        <Text className="text-sm text-[#7D6E60] mt-3">Loading session…</Text>
      </SafeAreaView>
    )
  }

  if (slots.length === 0 || activeMeals.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 items-center justify-center">
          <Text className="text-5xl mb-4">⚠️</Text>
          <Text className="text-xl font-bold text-[#2E241B] text-center mb-2">No slots loaded</Text>
          <Text className="text-sm text-[#7D6E60] text-center mb-8">
            This session has no confirmed slots — go back and load the cabinet first.
          </Text>
          <TouchableOpacity onPress={() => router.back()} className="bg-[#C96B1A] rounded-2xl px-8 py-3">
            <Text className="text-white font-bold text-base">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const active = findActive()
  const viewDayCells = activeMeals.map((mealKey, mealIdx) => ({
    mealKey,
    mealIdx,
    status: cellStatuses[cellKey(viewDayIndex, mealIdx)] ?? 'waiting',
    indices: slotIndicesForMeal(mealKey),
  }))

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
              Weekly Fill — Stage 2
            </Text>
            <Text className="text-[20px] leading-[26px] font-bold text-[#2E241B] mt-0.5" numberOfLines={1}>
              Dispensing for {patientName}
            </Text>
          </View>
        </View>

        {/* Day tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerStyle={{ paddingHorizontal: 16 }}>
          {DAYS.map((label, i) => {
            const isView = viewDayIndex === i
            const dayHasActive = active?.d === i
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setViewDayIndex(i)}
                className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                  isView ? 'bg-[#C96B1A]' : 'bg-white border border-[#EADBCB]'
                }`}
              >
                <Text className={`text-xs font-semibold ${isView ? 'text-white' : 'text-[#5A5145]'}`}>
                  {label}
                </Text>
                {dayHasActive && !isView ? (
                  <View className="w-1.5 h-1.5 rounded-full bg-[#C96B1A] ml-1.5" />
                ) : null}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Day title */}
        <View className="px-5 pb-2 flex-row items-center">
          <Text className="text-[18px] font-bold text-[#C96B1A]">{FULL_DAYS[viewDayIndex]}</Text>
          {active?.d === viewDayIndex ? (
            <Text className="text-[12px] text-[#C96B1A] ml-2">— dispensing now</Text>
          ) : null}
        </View>

        {/* Meal cards */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        >
          {viewDayCells.map(({ mealKey, status, indices }) => (
            <MealCard
              key={mealKey}
              mealKey={mealKey}
              status={status}
              indices={indices}
              slots={slots}
              onReady={handleReady}
              busy={busy}
              stopped={stopped}
            />
          ))}

          {/* Live event log */}
          <View className="bg-white rounded-2xl border border-[#EADBCB] p-4 mt-2">
            <Text className="text-[11px] uppercase tracking-widest text-[#7D6E60] font-semibold mb-2">
              Activity
            </Text>
            <ScrollView ref={eventsScrollRef} style={{ maxHeight: 160 }} nestedScrollEnabled>
              {events.length === 0 ? (
                <Text className="text-[12px] text-[#9B8E80] italic">No activity yet…</Text>
              ) : events.map((ev, i) => (
                <View key={i} className="flex-row items-start mb-1.5">
                  <Text className="text-[12px] mr-1.5">
                    {ev.type === 'homing'    ? '🔄'
                    : ev.type === 'moving'   ? '➡️'
                    : ev.type === 'picking'  ? '🤖'
                    : ev.type === 'delivering' ? '✅'
                    : ev.type === 'done'     ? '🎉'
                    : '❌'}
                  </Text>
                  <Text className="text-[12px] text-[#2E241B] flex-1">{ev.message}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="px-4 pb-6 pt-3 bg-[#F7F2EA] border-t border-[#EADBCB] flex-row gap-3">
          <TouchableOpacity
            onPress={handleEmergencyStop}
            disabled={stopped || completed}
            className={`px-4 py-3 rounded-2xl items-center justify-center flex-row ${
              stopped || completed ? 'bg-[#E8D5C4]' : 'bg-[#A3322A]'
            }`}
          >
            <Ionicons name="hand-left" size={16} color="white" />
            <Text className="text-white font-bold text-sm ml-1.5">Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReady}
            disabled={busy || stopped || !active}
            className={`flex-1 rounded-2xl py-3 items-center justify-center flex-row ${
              busy || stopped || !active ? 'bg-[#E8D5C4]' : 'bg-[#C96B1A]'
            }`}
          >
            {busy ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-bold text-sm ml-2">Dispensing…</Text>
              </>
            ) : (
              <>
                <Ionicons name="arrow-forward" size={16} color="white" />
                <Text className="text-white font-bold text-sm ml-2">
                  {stopped ? 'Stopped' : !active ? 'All cells done' : 'Ready for next'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}

function MealCard({
  mealKey,
  status,
  indices,
  slots,
  onReady,
  busy,
  stopped,
}: {
  mealKey: MealTime
  status: CellStatus
  indices: number[]
  slots: Pick<DispenserSlotsRow, 'slot_index' | 'medicine_id' | 'meal_times' | 'dose_quantity'>[]
  onReady: () => void
  busy: boolean
  stopped: boolean
}) {
  const meta = MEAL_LABELS[mealKey]
  const isActive = status === 'dispensing'
  const isDone = status === 'done'
  const cardStyle =
    isDone ? { backgroundColor: '#E3FCEA', borderColor: '#A8E5C9' }
    : isActive ? { backgroundColor: '#FFFFFF', borderColor: '#C96B1A' }
    : { backgroundColor: '#F4EFE5', borderColor: '#E4DDD0' }

  const meds = indices
    .map((idx) => slots.find((s) => s.slot_index === idx))
    .filter(Boolean)

  return (
    <View className="rounded-2xl border-2 px-4 py-4 mb-3" style={cardStyle}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-[#2E241B]">{meta.label}</Text>
          <Text className="text-[12px] text-[#7D6E60]">{meta.time}</Text>
        </View>
        <View className={`rounded-full px-3 py-1 ${
          isDone ? 'bg-[#18B88E]' : isActive ? 'bg-[#C96B1A]' : 'bg-[#C7BFAF]'
        }`}>
          <Text className="text-white text-[11px] font-bold">
            {isDone ? 'Done' : isActive ? 'Dispensing' : 'Waiting'}
          </Text>
        </View>
      </View>

      <View className="mt-2.5 pt-2.5 border-t border-[#EADBCB]">
        {meds.length === 0 ? (
          <Text className="text-[12px] text-[#9B8E80] italic">No medication for this meal</Text>
        ) : meds.map((m) => (
          <View key={m!.slot_index} className="flex-row items-center py-1">
            <View className="w-7 h-7 rounded-lg bg-[#FFF1DD] items-center justify-center mr-2">
              <Text className="text-[10px] font-bold text-[#8E4B14]">#{m!.slot_index}</Text>
            </View>
            <Text className="flex-1 text-[12px] text-[#2E241B]" numberOfLines={1}>
              Slot {m!.slot_index}
            </Text>
            <Text className="text-[11px] text-[#7D6E60]">×{m!.dose_quantity}</Text>
          </View>
        ))}
      </View>

      {isActive ? (
        <TouchableOpacity
          onPress={onReady}
          disabled={busy || stopped}
          activeOpacity={0.85}
          className={`mt-3 rounded-xl py-2.5 items-center ${
            busy || stopped ? 'bg-[#E8D5C4]' : 'bg-[#C96B1A]'
          }`}
        >
          <Text className="text-white text-[13px] font-bold">
            {busy ? 'Dispensing…' : 'Ready for next'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
