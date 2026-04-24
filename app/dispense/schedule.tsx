import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { dispenseSequence } from '../../src/lib/moonraker'
import { updateSessionStatus } from '../../src/lib/db/sessions'
import type { MealTime, PatientPrescriptionsRow } from '../../src/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

type SlotStatus = 'waiting' | 'dispensing' | 'done'

interface MealMedication {
  name:     string
  strength: string
  quantity: number
}

interface Slot {
  label:       string
  time:        string
  mealKey:     MealTime
  medications: MealMedication[]
  status:      SlotStatus
}

interface Day {
  name:  string
  slots: Slot[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const MEAL_CONFIG: { key: MealTime; label: string; time: string }[] = [
  { key: 'morning', label: 'Morning', time: '08:00' },
  { key: 'noon',    label: 'Noon',    time: '12:00' },
  { key: 'evening', label: 'Evening', time: '18:00' },
  { key: 'bedtime', label: 'Night',   time: '21:00' },
]

const CARD_SHADOW = {
  shadowColor: '#D5C3AF',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 14,
  elevation: 4,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSchedule(prescriptions: PatientPrescriptionsRow[]): Day[] {
  const activeMeals = MEAL_CONFIG.filter((m) =>
    prescriptions.some((p) => p.meal_times.includes(m.key)),
  )
  return DAY_FULL.map((dayName) => ({
    name:  dayName,
    slots: activeMeals.map((meal, si): Slot => ({
      label:       meal.label,
      time:        meal.time,
      mealKey:     meal.key,
      status:      si === 0 ? 'dispensing' : 'waiting',
      medications: [], // filled below
    })),
  }))
}

function buildSlotMeds(
  prescriptions: (PatientPrescriptionsRow & { medicines?: { name: string; strength: string | null } | null })[],
  mealKey: MealTime,
): MealMedication[] {
  return prescriptions
    .filter((p) => p.meal_times.includes(mealKey))
    .map((p) => ({
      name:     p.medicines?.name     ?? 'Unknown',
      strength: p.medicines?.strength ?? '',
      quantity: p.dose_quantity,
    }))
}

function getSlotIndicesForMeal(prescriptions: PatientPrescriptionsRow[], mealKey: MealTime): number[] {
  return prescriptions.reduce<number[]>((acc, p, i) => {
    if (p.meal_times.includes(mealKey)) acc.push(i + 1)
    return acc
  }, [])
}

function findActive(days: Day[]): { d: number; s: number } | null {
  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < days[d].slots.length; s++) {
      if (days[d].slots[s].status === 'dispensing') return { d, s }
    }
  }
  return null
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DispenseScheduleScreen() {
  const router = useRouter()
  const {
    patientId   = '',
    patientName = 'Patient',
    wardId      = '',
    ward        = '',
    sessionId   = '',
  } = useLocalSearchParams<{
    patientId:   string
    patientName: string
    wardId:      string
    ward:        string
    sessionId:   string
  }>()

  const [schedule,      setSchedule]      = useState<Day[]>([])
  const [prescriptions, setPrescriptions] = useState<(PatientPrescriptionsRow & { medicines?: { name: string; strength: string | null } | null })[]>([])
  const [viewDayIndex,  setViewDayIndex]  = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [isDispensing,  setIsDispensing]  = useState(false)

  const didInit = useRef(false)

  useEffect(() => {
    if (!patientId) return
    async function load() {
      try {
        const { data, error } = await supabase
          .from('patient_prescriptions')
          .select('*, medicines(name, strength)')
          .eq('patient_id', patientId)
          .eq('is_active', true)
        if (error) { console.error(error); return }
        const ps = (data ?? []) as (PatientPrescriptionsRow & { medicines?: { name: string; strength: string | null } | null })[]
        setPrescriptions(ps)

        const days = buildSchedule(ps)
        const filled = days.map((day) => ({
          ...day,
          slots: day.slots.map((slot) => ({
            ...slot,
            medications: buildSlotMeds(ps, slot.mealKey),
          })),
        }))
        setSchedule(filled)

        if (!didInit.current) {
          didInit.current = true
          const activeMeals = MEAL_CONFIG.filter((m) => ps.some((p) => p.meal_times.includes(m.key)))
          if (activeMeals.length > 0) {
            const indices = getSlotIndicesForMeal(ps, activeMeals[0].key)
            setIsDispensing(true)
            dispenseSequence(indices)
              .catch(console.error)
              .finally(() => setIsDispensing(false))
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  const handleReady = async () => {
    const active = findActive(schedule)
    if (!active) return

    let nextD = active.d
    let nextS = active.s + 1
    if (nextS >= schedule[nextD].slots.length) {
      nextD++
      nextS = 0
    }

    const isLast = nextD >= schedule.length

    const newSchedule = schedule.map((day, di) => ({
      ...day,
      slots: day.slots.map((slot, si) => {
        if (di === active.d && si === active.s)   return { ...slot, status: 'done' as const }
        if (!isLast && di === nextD && si === nextS) return { ...slot, status: 'dispensing' as const }
        return { ...slot }
      }),
    }))
    setSchedule(newSchedule)

    if (isLast) {
      try {
        await updateSessionStatus(sessionId, 'completed')
      } catch (err) {
        console.error('[PILLo] Failed to finalise session:', err)
      }

      const allSlots   = newSchedule.flatMap((d) => d.slots)
      const totalTabs  = allSlots.reduce((sum, s) => sum + s.medications.reduce((t, m) => t + m.quantity, 0), 0)
      const types      = new Set(allSlots.flatMap((s) => s.medications.map((m) => m.name))).size
      const maxMeals   = Math.max(...newSchedule.map((d) => d.slots.length))

      router.replace({
        pathname: '/dispense/complete',
        params: {
          patientName,
          ward,
          wardId,
          sessionId,
          meals:     String(maxMeals),
          totalTabs: String(totalTabs),
          types:     String(types),
        },
      })
    } else {
      const activeMeals = MEAL_CONFIG.filter((m) => prescriptions.some((p) => p.meal_times.includes(m.key)))
      const nextMealKey = activeMeals[nextS]?.key
      if (nextMealKey) {
        const indices = getSlotIndicesForMeal(prescriptions, nextMealKey)
        setIsDispensing(true)
        dispenseSequence(indices)
          .catch(console.error)
          .finally(() => setIsDispensing(false))
      }
      setViewDayIndex(nextD)
    }
  }

  const active  = findActive(schedule)
  const viewDay = schedule[viewDayIndex]

  if (loading || !viewDay) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] items-center justify-center" edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#C96B1A" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F7F2EA]" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-1">
        <View className="flex-1">
          <Text className="text-[20px] font-bold text-[#303030]">{patientName}</Text>
          <Text className="text-[13px] text-[#7D8798] mt-0.5">Weekly dispense schedule</Text>
        </View>
        {isDispensing && (
          <View className="flex-row items-center bg-[#FFF0E0] px-3 py-1.5 rounded-full">
            <ActivityIndicator size="small" color="#C96B1A" />
            <Text className="text-[12px] text-[#C96B1A] ml-2 font-semibold">Dispensing…</Text>
          </View>
        )}
      </View>

      {/* Day tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 8 }}
      >
        {schedule.map((day, i) => {
          const isActiveDay = active?.d === i
          const isView      = viewDayIndex === i
          return (
            <TouchableOpacity
              key={day.name}
              onPress={() => setViewDayIndex(i)}
              activeOpacity={0.8}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: isView ? '#C96B1A' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isView ? '#C96B1A' : '#E4E0DA',
              }}
            >
              <View className="flex-row items-center gap-1">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: isView ? '#fff' : '#4A4A4A' }}
                >
                  {DAY_SHORT[i]}
                </Text>
                {isActiveDay && !isView && (
                  <View className="w-1.5 h-1.5 rounded-full bg-[#C96B1A]" />
                )}
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Day label */}
      <View className="px-5 pb-2">
        <Text className="text-[17px] font-bold text-[#303030]">
          {viewDay.name}
          {active?.d === viewDayIndex ? (
            <Text className="text-[#C96B1A]"> — dispensing now</Text>
          ) : null}
        </Text>
      </View>

      {/* Meal cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}
      >
        {viewDay.slots.map((slot) => (
          <View
            key={slot.label}
            className="bg-white rounded-[20px] p-4"
            style={[
              CARD_SHADOW,
              { width: 180 },
              slot.status === 'dispensing' && { borderWidth: 2, borderColor: '#F6AB52' },
              slot.status === 'done'       && { opacity: 0.65 },
            ]}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[14px] font-bold text-[#303030]">{slot.label}</Text>
              <View
                className="w-6 h-6 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    slot.status === 'done'       ? '#DDFBF3' :
                    slot.status === 'dispensing' ? '#FFF0E0' : '#F5F0EA',
                }}
              >
                {slot.status === 'done' ? (
                  <Ionicons name="checkmark" size={14} color="#24B88F" />
                ) : slot.status === 'dispensing' ? (
                  <Ionicons name="time-outline" size={14} color="#C96B1A" />
                ) : (
                  <Ionicons name="hourglass-outline" size={14} color="#BBBBBB" />
                )}
              </View>
            </View>

            <Text className="text-[11px] text-[#7D8798] mb-2">{slot.time}</Text>

            {slot.medications.map((med, mi) => (
              <View key={mi} className="flex-row items-center mb-1">
                <Ionicons name="medical-outline" size={12} color="#C96B1A" />
                <Text className="text-[12px] text-[#373737] ml-1.5 flex-1" numberOfLines={1}>
                  {med.name}
                  <Text className="text-[#8891A1]"> ×{med.quantity}</Text>
                </Text>
              </View>
            ))}

            {slot.status === 'dispensing' && (
              <View className="mt-3 bg-[#FFF0E0] rounded-xl py-1.5 items-center">
                <Text className="text-[11px] font-semibold text-[#C96B1A]">In progress</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Ready for next button */}
      <View className="px-5 pb-6 pt-2">
        {active ? (
          <TouchableOpacity
            onPress={handleReady}
            disabled={isDispensing}
            activeOpacity={0.85}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: isDispensing ? '#E0D7CE' : '#C96B1A' }}
          >
            <Text
              className="text-[16px] font-bold"
              style={{ color: isDispensing ? '#A89E93' : '#fff' }}
            >
              {isDispensing ? 'Machine running…' : 'Ready for next →'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="rounded-2xl py-4 items-center bg-[#DDFBF3]">
            <Text className="text-[16px] font-bold text-[#24B88F]">All slots completed!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}
