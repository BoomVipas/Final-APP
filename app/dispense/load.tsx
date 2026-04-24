import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import {
  getMachineStatus,
  homeAllAxes,
  moveCabinetToFill,
} from '../../src/lib/moonraker'
import {
  createDispenseSession,
  upsertDispenserSlot,
  confirmDispenserSlot,
  generateDispenseItems,
} from '../../src/lib/db/sessions'
import type { MealTime } from '../../src/types/database'

interface MedCard {
  id:          string
  medicine_id: string
  medicineName: string
  strength:    string
  meal_times:  MealTime[]
  dose_quantity: number
  isAdded:     boolean
}

const CARD_SHADOW = {
  shadowColor: '#D5C3AF',
  shadowOpacity: 0.22,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 16,
  elevation: 4,
}

export default function DispenseLoadScreen() {
  const router = useRouter()
  const {
    patientId   = '',
    patientName = 'Patient',
    wardId      = '',
    ward        = '',
  } = useLocalSearchParams<{
    patientId:   string
    patientName: string
    wardId:      string
    ward:        string
  }>()

  const [medicines,     setMedicines]     = useState<MedCard[]>([])
  const [loading,       setLoading]       = useState(true)
  const [starting,      setStarting]      = useState(false)
  const [currentFillIndex, setCurrentFillIndex] = useState(0)
  const [isMoving,      setIsMoving]      = useState(false)
  const [movingId,      setMovingId]      = useState<string | null>(null)
  const [filledIds,     setFilledIds]     = useState<string[]>([])
  const [isPrinterOnline, setIsPrinterOnline] = useState(false)
  const [isHoming,      setIsHoming]      = useState(false)
  const [machineError,  setMachineError]  = useState<string | null>(null)

  const didInitMachine = useRef(false)

  // Load active prescriptions
  useEffect(() => {
    if (!patientId) return
    async function load() {
      try {
        const { data, error } = await supabase
          .from('patient_prescriptions')
          .select('id, medicine_id, dose_quantity, meal_times, medicines(name, strength)')
          .eq('patient_id', patientId)
          .eq('is_active', true)
        if (error) { console.error(error); return }
        setMedicines(
          (data ?? []).map((p) => {
            const med = (p.medicines as unknown as { name: string; strength: string | null } | null) ?? null
            return {
              id:            p.id,
              medicine_id:   p.medicine_id,
              medicineName:  med?.name     ?? 'Unknown',
              strength:      med?.strength ?? '',
              meal_times:    p.meal_times as MealTime[],
              dose_quantity: p.dose_quantity,
              isAdded:       false,
            }
          }),
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  // Home machine on mount
  useEffect(() => {
    if (didInitMachine.current) return
    didInitMachine.current = true

    async function initMachine() {
      try {
        const status = await getMachineStatus()
        if (status.state === 'ready' || status.state === 'printing') {
          setIsPrinterOnline(true)
          setIsHoming(true)
          await homeAllAxes()
          setCurrentFillIndex(0)
        } else {
          setMachineError(`Machine not ready (${status.state})`)
        }
      } catch {
        setMachineError('Machine offline — check WiFi connection')
      } finally {
        setIsHoming(false)
      }
    }
    initMachine()
  }, [])

  const handleCardTap = useCallback(async (id: string) => {
    if (isMoving) return
    if (medicines[currentFillIndex]?.id !== id) return

    const nextIndex = currentFillIndex + 1
    setMovingId(id)
    setIsMoving(true)
    try {
      if (nextIndex < medicines.length) {
        await moveCabinetToFill(nextIndex + 1)
      }
      setFilledIds((prev) => [...prev, id])
      setCurrentFillIndex(nextIndex)
      setMachineError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMachineError(`Failed to move to slot ${nextIndex + 1}: ${msg}`)
    } finally {
      setMovingId(null)
      setIsMoving(false)
    }
  }, [isMoving, currentFillIndex, medicines])

  const canStart = currentFillIndex === medicines.length && medicines.length > 0 && isPrinterOnline && !isMoving

  const handleStartDispense = useCallback(async () => {
    if (!canStart || starting) return
    setStarting(true)
    try {
      const session = await createDispenseSession(patientId, wardId)

      for (let i = 0; i < medicines.length; i++) {
        const med = medicines[i]
        await upsertDispenserSlot(
          session.id, i + 1, med.medicine_id, patientId,
          med.dose_quantity, med.meal_times,
        )
        await confirmDispenserSlot(session.id, i + 1)
      }

      await generateDispenseItems(session.id)

      router.push({
        pathname: '/dispense/schedule',
        params: {
          patientId,
          patientName,
          wardId,
          ward,
          sessionId: session.id,
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      Alert.alert('Error', `Failed to start session: ${msg}`)
      setStarting(false)
    }
  }, [canStart, starting, patientId, wardId, patientName, ward, medicines, router])

  return (
    <SafeAreaView className="flex-1 bg-[#F7F2EA]" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-2 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center mr-3"
        >
          <Ionicons name="chevron-back" size={26} color="#313131" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-[20px] font-bold text-[#303030]">Load Medications</Text>
          <Text className="text-[13px] text-[#7D8798] mt-0.5">{patientName}</Text>
        </View>
      </View>

      {/* Machine status banner */}
      {(isHoming || machineError) && (
        <View className={`mx-5 mb-3 px-4 py-2.5 rounded-2xl ${machineError ? 'bg-red-50' : 'bg-blue-50'}`}>
          <Text className={`text-[13px] ${machineError ? 'text-red-600' : 'text-blue-600'}`}>
            {isHoming ? '🔄 Homing machine, please wait…' : `⚠️ ${machineError}`}
          </Text>
        </View>
      )}

      {/* Instruction */}
      <View className="mx-5 mb-3 px-4 py-2.5 bg-[#FFF5EA] rounded-2xl">
        <Text className="text-[13px] text-[#8E4B14]">
          Tap each card in order to load the medicine into the highlighted slot. The machine will move to each fill position automatically.
        </Text>
      </View>

      {/* Medicine list */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#C96B1A" style={{ marginTop: 40 }} />
        ) : medicines.length === 0 ? (
          <View className="items-center mt-16">
            <Ionicons name="medical-outline" size={48} color="#D4C5B4" />
            <Text className="text-[15px] text-[#8891A1] mt-3">No active prescriptions found</Text>
          </View>
        ) : (
          medicines.map((med, index) => {
            const isCurrent = index === currentFillIndex
            const isFilled  = filledIds.includes(med.id)
            const isLocked  = index > currentFillIndex

            return (
              <TouchableOpacity
                key={med.id}
                onPress={() => handleCardTap(med.id)}
                activeOpacity={isLocked || isFilled ? 1 : 0.85}
                disabled={isLocked || isFilled}
                className="bg-white rounded-[20px] mb-3 px-4 py-4 flex-row items-center"
                style={[
                  CARD_SHADOW,
                  isCurrent && !isFilled && { borderWidth: 2, borderColor: '#F6AB52' },
                  isLocked && { opacity: 0.45 },
                ]}
              >
                {/* Slot number */}
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: isFilled ? '#DDFBF3' : isCurrent ? '#FFF0E0' : '#F5F0EA' }}
                >
                  {movingId === med.id ? (
                    <ActivityIndicator size="small" color="#C96B1A" />
                  ) : isFilled ? (
                    <Ionicons name="checkmark" size={20} color="#24B88F" />
                  ) : (
                    <Text className="text-[13px] font-bold text-[#8E4B14]">{index + 1}</Text>
                  )}
                </View>

                {/* Info */}
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-[#373737]" numberOfLines={1}>
                    {med.medicineName}
                  </Text>
                  {med.strength ? (
                    <Text className="text-[12px] text-[#7D8798] mt-0.5">{med.strength}</Text>
                  ) : null}
                  <Text className="text-[12px] text-[#7D8798] mt-0.5">
                    {med.dose_quantity} tab{med.dose_quantity !== 1 ? 's' : ''} · {med.meal_times.join(', ')}
                  </Text>
                </View>

                {/* State label */}
                {isFilled ? (
                  <View className="bg-[#DDFBF3] px-3 py-1 rounded-full">
                    <Text className="text-[12px] font-semibold text-[#24B88F]">Loaded</Text>
                  </View>
                ) : isCurrent ? (
                  <View className="bg-[#FFF0E0] px-3 py-1 rounded-full">
                    <Text className="text-[12px] font-semibold text-[#C96B1A]">Tap to load</Text>
                  </View>
                ) : (
                  <Ionicons name="lock-closed-outline" size={16} color="#BBBBBB" />
                )}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>

      {/* Start Dispense button */}
      <View className="px-5 pb-6 pt-2">
        <TouchableOpacity
          onPress={handleStartDispense}
          disabled={!canStart || starting}
          activeOpacity={0.85}
          className="rounded-2xl py-4 items-center"
          style={{ backgroundColor: canStart && !starting ? '#C96B1A' : '#E0D7CE' }}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className="text-[16px] font-bold"
              style={{ color: canStart ? '#fff' : '#A89E93' }}
            >
              Start Dispense
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
