import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useAuthStore } from '../../src/stores/authStore'
import { useMedicationStore, type ScheduleItem } from '../../src/stores/medicationStore'
import { usePatientStore } from '../../src/stores/patientStore'
import { USE_MOCK } from '../../src/mocks'
import { supabase } from '../../src/lib/supabase'
import type { DispenseItemsRow, DispenseSessionsRow, MealTime, PatientsRow } from '../../src/types/database'
import { PatientAvatar } from '../../src/components/shared/PatientAvatar'
import HeroSectionImg from '../../icons/HeroSection.png'
import DocumentIcon from '../../icons/Document.svg'
import DispenseIcon from '../../icons/Dispense.svg'
import HealthIcon from '../../icons/Health.svg'
import UnionIcon from '../../icons/Ward.svg'
import HomeIcon from '../../icons/Home.svg'
import WardIcon from '../../icons/Ward.svg'
import MedicineIcon from '../../icons/Medicine.svg'
import TickIcon from '../../icons/Tick.svg'
import {
  getMachineStatus,
  runDispenseSequence,
  emergencyStop,
  type MachineStatus,
  type DispenseProgressEvent,
} from '../../src/lib/moonraker'

type TabType = 'patients' | 'dispense'

const SUMMARY_FRAME_WIDTH = 370
type SortMode = 'name' | 'room' | 'urgency'
type PatientBadge = 'urgent' | 'dispensed' | 'low_medication'

interface PatientMeta {
  id: string
  name: string
  room: string | null
  dateOfBirth: string | null
}

interface WardPatientCard {
  id: string
  name: string
  room: string
  age: number | null
  tablets: number
  badges: PatientBadge[]
  isFallback?: boolean
}

interface DispenseCardData {
  id: string
  name: string
  room: string
  tablets: number
  isFallback?: boolean
}

interface DispenseDataset {
  pending: DispenseCardData[]
  dispensed: DispenseCardData[]
  dispensedCount: number
  source: 'tables' | 'schedule' | 'demo'
}

const CARD_SHADOW = {
  shadowColor: '#D5C3AF',
  shadowOpacity: 0.28,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 22,
  elevation: 6,
}

const SLOT_META: Array<{ key: MealTime; label: string }> = [
  { key: 'morning', label: 'Morning' },
  { key: 'noon', label: 'Noon' },
  { key: 'evening', label: 'Evening' },
  { key: 'bedtime', label: 'Night' },
]

const SORT_META: SortMode[] = ['name', 'room', 'urgency']

const DEMO_PATIENTS: WardPatientCard[] = [
  { id: 'demo-p1', name: 'Mrs. Somsri Phakrammongkol', room: 'A-101', age: 79, tablets: 9, badges: ['urgent'], isFallback: true },
  { id: 'demo-p2', name: 'Mrs. Somchai Rungreang', room: 'A-102', age: 79, tablets: 12, badges: ['urgent'], isFallback: true },
  { id: 'demo-p3', name: 'Mr. Mana Jai', room: 'B-203', age: 69, tablets: 5, badges: ['dispensed'], isFallback: true },
  { id: 'demo-p4', name: 'Mrs. Dararat Prasartngam', room: 'B-204', age: 80, tablets: 11, badges: ['urgent', 'low_medication'], isFallback: true },
  { id: 'demo-p5', name: 'Mrs. Kanya Singkow', room: 'B-205', age: 67, tablets: 12, badges: ['urgent'], isFallback: true },
]

const DEMO_DISPENSE_PENDING: DispenseCardData[] = [
  { id: 'demo-d1', name: 'Mrs. Somchai Rungreang', room: 'B-203', tablets: 5, isFallback: true },
  { id: 'demo-d2', name: 'Mrs. Kanya Singkow', room: 'B-203', tablets: 5, isFallback: true },
]

const DEMO_DISPENSED: DispenseCardData[] = [
  { id: 'demo-done-1', name: 'Mr. Mana Jai', room: 'B-203', tablets: 5, isFallback: true },
  { id: 'demo-done-2', name: 'Mrs. Dararat Prasartngam', room: 'B-204', tablets: 11, isFallback: true },
]

function formatWardLabel(value: string | null | undefined): string {
  if (!value) return 'Ward A'

  const normalized = value.replace(/_/g, '-').trim()
  const explicitLetter = normalized.match(/^ward-([a-z])$/i)
  if (explicitLetter) return `Ward ${explicitLetter[1].toUpperCase()}`

  const numeric = normalized.match(/(\d+)/)
  if (numeric) {
    return `Ward ${numeric[1]}`
  }

  if (/^ward/i.test(normalized)) {
    const suffix = normalized.replace(/^ward[-\s]*/i, '').trim()
    return `Ward ${suffix || 'A'}`
  }

  return `Ward ${normalized.toUpperCase()}`
}

function resolveWardId(routeWardId: string | undefined, userWardId: string | null | undefined): string {
  if (!routeWardId) return userWardId ?? ''
  if (/^ward-[a-z]$/i.test(routeWardId) && userWardId) return userWardId
  return routeWardId
}

function normalizeMealTime(value: string | null | undefined): MealTime | null {
  if (!value) return null
  if (value === 'night') return 'bedtime'
  if (value === 'morning' || value === 'noon' || value === 'evening' || value === 'bedtime') {
    return value
  }
  return null
}

function getAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1
  return age
}

function roomSortValue(room: string): string {
  return room.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
}

function badgePriority(card: WardPatientCard): number {
  if (card.badges.includes('urgent')) return 0
  if (card.badges.includes('low_medication')) return 1
  if (card.badges.includes('dispensed')) return 2
  return 3
}

function createDispenseRows(
  quantities: Map<string, number>,
  patientMetaById: Map<string, PatientMeta>,
): DispenseCardData[] {
  return [...quantities.entries()]
    .map(([patientId, tablets]) => {
      const meta = patientMetaById.get(patientId)
      return {
        id: patientId,
        name: meta?.name ?? 'Unknown Patient',
        room: meta?.room ?? 'Room -',
        tablets,
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function EmptyCard({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
  return (
    <View
      className="bg-white rounded-[28px] mx-5 px-6 py-10 items-center"
      style={CARD_SHADOW}
    >
      <View className="w-16 h-16 rounded-full bg-[#FFF5EA] items-center justify-center mb-4">
        <Ionicons name={icon} size={28} color="#EFA54F" />
      </View>
      <Text className="text-[20px] leading-[26px] font-semibold text-[#323232] text-center">{title}</Text>
      <Text className="text-[14px] leading-[20px] text-[#8891A1] text-center mt-2">{subtitle}</Text>
    </View>
  )
}

function StatusBadge({ badge }: { badge: PatientBadge }) {
  if (badge === 'urgent') {
    return (
      <View className="flex-row items-center bg-[#FDECED] px-3 py-1 rounded-full mr-2 mb-1.5">
        <Ionicons name="alert-circle" size={12} color="#F26666" />
        <Text className="text-[12px] leading-[16px] font-medium text-[#F26666] ml-1.5">Urgent</Text>
      </View>
    )
  }

  if (badge === 'dispensed') {
    return (
      <View className="flex-row items-center bg-[#DDFBF3] px-3 py-1 rounded-full mr-2 mb-1.5">
        <Ionicons name="checkmark-circle" size={12} color="#24B88F" />
        <Text className="text-[12px] leading-[16px] font-medium text-[#24B88F] ml-1.5">Dispensed</Text>
      </View>
    )
  }

  return (
    <View className="flex-row items-center bg-[#FEF1E6] px-3 py-1 rounded-full mr-2 mb-1.5">
      <Ionicons name="warning" size={12} color="#F2A14C" />
      <Text className="text-[12px] leading-[16px] font-medium text-[#F2A14C] ml-1.5">Low Medication</Text>
    </View>
  )
}

function HeaderBackground() {
  return (
    <View className="absolute inset-0 overflow-hidden">
      <LinearGradient
        colors={['#FFF8EF', '#F7D8B4', '#F1B05C']}
        start={{ x: 0.08, y: 0.04 }}
        end={{ x: 0.85, y: 1 }}
        className="absolute inset-0"
      />
      <View className="absolute inset-0 opacity-25">
        <View className="absolute left-0 top-8 bottom-16 w-[90px] border-r border-[#E3B47E]" />
        <View className="absolute right-0 top-16 bottom-16 w-[88px] border-l border-[#E3B47E]" />
        <View className="absolute left-[88px] right-[88px] top-16 bottom-10 bg-white/45" />
        <View className="absolute left-[130px] right-[130px] top-8 h-[2px] bg-white/65" />
        <View className="absolute left-[130px] right-[130px] top-28 h-[2px] bg-white/55" />
        <View className="absolute left-[130px] right-[130px] top-48 h-[2px] bg-white/45" />
      </View>
      <View className="absolute left-[-34px] top-10 w-24 h-44 rounded-full border border-[#EABF8E] opacity-45" />
      <View className="absolute right-[-20px] top-[-10px] w-48 h-48 rounded-full border border-[#EAC596] opacity-40" />
      <LinearGradient
        colors={['rgba(245,240,232,0)', '#F7F2EA']}
        start={{ x: 0.5, y: 0.25 }}
        end={{ x: 0.5, y: 1 }}
        className="absolute left-0 right-0 bottom-0 h-32"
      />
    </View>
  )
}

function SummaryStat({ value, label, borderRight }: { value: number; label: string; borderRight?: boolean }) {
  return (
    <View className="flex-1 items-center justify-center py-4">
      <Text className="text-[28px] leading-[34px] font-semibold text-[#373737]">{value}</Text>
      <Text className="text-[12px] leading-[16px] text-[#7D8798] mt-1">{label}</Text>
      {borderRight ? <View className="absolute right-0 top-4 bottom-4 w-px bg-[#ECEAE6]" /> : null}
    </View>
  )
}


function InternalTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 items-center justify-center pb-2.5 pt-2.5"
      style={active ? { borderBottomWidth: 2, borderBottomColor: '#EFA54F' } : { borderBottomWidth: 2, borderBottomColor: 'transparent' }}
    >
      <View className="flex-row items-center">
        {label === 'Patients' ? (
          <DocumentIcon width={20} height={20} color={active ? '#EFA54F' : '#2F2F2F'} />
        ) : (
          <DispenseIcon width={20} height={20} color={active ? '#EFA54F' : '#2F2F2F'} />
        )}
        <Text
          className="text-[14px] leading-[20px] font-medium ml-2"
          style={{ color: active ? '#EFA54F' : '#1F1F1F' }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function PatientRow({
  card,
  onPress,
  onMore,
}: {
  card: WardPatientCard
  onPress: () => void
  onMore: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white rounded-[20px] mx-4 mb-3 px-4 py-4 flex-row items-start"
      style={CARD_SHADOW}
    >
      <PatientAvatar name={card.name} size={48} className="mr-3 mt-0.5" />

      <View className="flex-1 pr-2">
        <Text className="text-[15px] leading-[21px] font-semibold text-[#373737]" numberOfLines={1}>
          {card.name}
        </Text>

        <View className="flex-row items-center mt-1.5">
          <UnionIcon width={14} height={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">
            Room {card.room}
            {card.age !== null ? ` • Age ${card.age}` : ''}
          </Text>
        </View>

        <View className="flex-row items-center mt-1.5">
          <HealthIcon width={14} height={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">{card.tablets} tablets</Text>
        </View>

        {card.badges.length > 0 ? (
          <View className="flex-row flex-wrap mt-2">
            {card.badges.map((badge) => (
              <StatusBadge key={badge} badge={badge} />
            ))}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${card.name}`}
        onPress={onMore}
        hitSlop={10}
        className="w-12 h-12 items-center justify-center -mt-1 -mr-1"
      >
        <Ionicons name="ellipsis-vertical" size={18} color="#4A4A4A" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

function TimeChip({
  label,
  active,
  completed,
  onPress,
}: {
  label: string
  active: boolean
  completed?: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        overflow: 'hidden',
      }}
    >
      {completed ? (
        <LinearGradient
          colors={['#DDFBF3', '#F4FFFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, borderWidth: 1, borderColor: '#BDEFE3' }}
        />
      ) : (
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: active ? '#F6AB52' : '#FFFFFF',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: active ? '#F6AB52' : '#E4E2DE',
          }}
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {completed ? (
          <TickIcon width={16} height={16} style={{ marginRight: 5 }} />
        ) : null}
        <Text
          style={{
            fontSize: 14,
            color: active ? '#2A2A2A' : completed ? '#18B88E' : '#313131',
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function DispenseRow({
  card,
  selected,
  onToggle,
}: {
  card: DispenseCardData
  selected: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.9}
      className="bg-white rounded-[20px] mx-4 mb-3 px-4 py-4 flex-row items-center"
      style={CARD_SHADOW}
    >
      <View
        className="w-8 h-8 rounded-full border-2 mr-4 items-center justify-center"
        style={{ borderColor: selected ? '#F1A44F' : '#DDDEDF' }}
      >
        {selected ? <View className="w-4 h-4 rounded-full bg-[#F1A44F]" /> : null}
      </View>

      <View className="flex-1">
        <Text className="text-[15px] leading-[21px] font-semibold text-[#373737]" numberOfLines={1}>
          {card.name}
        </Text>
        <View className="flex-row items-center mt-1.5">
          <Ionicons name="cube-outline" size={14} color="#8C93A4" />
          <Text className="text-[13px] leading-[18px] text-[#7F8898] ml-1.5">Room {card.room}</Text>
        </View>
      </View>

      <View className="flex-row items-center ml-3">
        <MedicineIcon width={16} height={16} color="#F1A44F" />
        <Text className="text-[14px] leading-[20px] font-semibold text-[#F1A44F] ml-1.5">
          {card.tablets} tablets
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function BottomNav({
  onHome,
  onWard,
  onProfile,
}: {
  onHome: () => void
  onWard: () => void
  onProfile: () => void
}) {
  return (
    <View className="bg-white border-t border-[#ECE5DB] px-8 pt-3 pb-5">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={onHome} className="items-center min-w-[76px]">
          <HomeIcon width={30} height={30} color="#2F2F2F" />
          <Text className="text-[11px] leading-[16px] text-[#2F2F2F] mt-1.5">Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onWard} className="items-center min-w-[76px]">
          <WardIcon width={30} height={30} color="#F2A14C" />
          <Text className="text-[11px] leading-[16px] font-semibold text-[#2F2F2F] mt-1.5">Ward</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onProfile} className="items-center min-w-[76px]">
          <Ionicons name="person" size={30} color="#2F2F2F" />
          <Text className="text-[11px] leading-[16px] text-[#2F2F2F] mt-1.5">Profile</Text>
        </TouchableOpacity>
      </View>

      <View className="h-1.5 w-32 rounded-full self-center mt-4" />
    </View>
  )
}

// ─── Dispense flow modal ─────────────────────────────────────────────────────

type DispenseModalPhase = 'confirm' | 'running' | 'done' | 'error'

interface DispenseJob {
  patientId: string
  patientName: string
  room: string
  cabinet: number
  tablets: number
}

function DispenseModal({
  visible,
  jobs,
  timeLabel,
  onClose,
  onConfirm,
}: {
  visible: boolean
  jobs: DispenseJob[]
  timeLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [phase, setPhase]       = useState<DispenseModalPhase>('confirm')
  const [events, setEvents]     = useState<DispenseProgressEvent[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const scrollRef               = useRef<ScrollView>(null)

  useEffect(() => {
    if (visible) { setPhase('confirm'); setEvents([]); setErrorMsg('') }
  }, [visible])

  const handleStart = async () => {
    setPhase('running')
    setEvents([])
    try {
      await onConfirm()
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Dispense failed')
      setPhase('error')
    }
  }

  const totalTablets = jobs.reduce((s, j) => s + j.tablets, 0)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={phase === 'confirm' ? onClose : undefined}>
        <View className="flex-1" />
        <Pressable onPress={() => {}} className="bg-[#FFF9F2] rounded-t-[32px] px-5 pt-6 pb-8" style={{ maxHeight: '85%' }}>

          {/* ── Confirm phase ─────────────────────────────── */}
          {phase === 'confirm' && (
            <>
              <View className="flex-row items-center justify-between mb-5">
                <View>
                  <Text className="text-xs font-semibold uppercase tracking-widest text-[#8E4B14]">PILLo Dispenser</Text>
                  <Text className="text-xl font-bold text-[#2E241B] mt-0.5">Confirm Dispense</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-[#F0E8DE] items-center justify-center">
                  <Ionicons name="close" size={18} color="#5E5145" />
                </TouchableOpacity>
              </View>

              {/* Summary */}
              <View className="flex-row gap-3 mb-5">
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{jobs.length}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Patients</Text>
                </View>
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{totalTablets}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Total doses</Text>
                </View>
                <View className="flex-1 bg-[#F6EBDD] rounded-2xl px-3 py-3 items-center">
                  <Text className="text-xl font-bold text-[#2E241B]">{timeLabel}</Text>
                  <Text className="text-xs text-[#7D6E60] mt-0.5">Time slot</Text>
                </View>
              </View>

              {/* Patient list */}
              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} className="mb-5">
                {jobs.map((job, i) => (
                  <View key={job.patientId} className="flex-row items-center py-2.5 border-b border-[#F0E8DE]">
                    <View className="w-7 h-7 rounded-full bg-[#F6EBDD] items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-[#8E4B14]">{i + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-[#2E241B]">{job.patientName}</Text>
                      <Text className="text-xs text-[#7D6E60]">Room {job.room} · Slot {job.cabinet}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="medical-outline" size={14} color="#C96B1A" />
                      <Text className="text-sm font-semibold text-[#C96B1A] ml-1">{job.tablets}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mb-5 flex-row items-start">
                <Text className="text-base mr-2">⚠️</Text>
                <Text className="text-xs text-amber-700 flex-1">
                  Ensure the collection tray is in place and patients are ready before starting.
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleStart}
                className="bg-[#C96B1A] rounded-2xl py-4 items-center"
              >
                <Text className="text-white font-bold text-base">Start Dispensing</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} className="items-center py-3 mt-1">
                <Text className="text-sm text-[#7D6E60]">Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Running phase ─────────────────────────────── */}
          {phase === 'running' && (
            <>
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-[20px] bg-[#FFF0E0] items-center justify-center mb-4">
                  <ActivityIndicator size="large" color="#C96B1A" />
                </View>
                <Text className="text-lg font-bold text-[#2E241B]">Dispensing in progress</Text>
                <Text className="text-xs text-[#7D6E60] mt-1">Do not move the dispenser</Text>
              </View>

              {/* Progress bar */}
              {events.length > 0 && (
                <View className="bg-[#F0E8DE] rounded-full h-2 mb-5 overflow-hidden">
                  <View
                    className="bg-[#C96B1A] h-2 rounded-full"
                    style={{ width: `${Math.min(100, (events.filter(e => e.type === 'delivering').length / jobs.length) * 100)}%` }}
                  />
                </View>
              )}

              {/* Live log */}
              <ScrollView
                ref={scrollRef}
                style={{ maxHeight: 260 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {events.map((ev, i) => (
                  <View key={i} className="flex-row items-start mb-2">
                    <Text className="text-base mr-2 mt-0.5">
                      {ev.type === 'homing'    ? '🔄'
                      : ev.type === 'moving'   ? '➡️'
                      : ev.type === 'picking'  ? '🤖'
                      : ev.type === 'delivering' ? '✅'
                      : ev.type === 'done'     ? '🎉'
                      : '❌'}
                    </Text>
                    <Text className="text-sm text-[#2E241B] flex-1">{ev.message}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => emergencyStop().then(() => setPhase('error')).catch(() => setPhase('error'))}
                className="bg-red-500 rounded-2xl py-3 items-center mt-4"
              >
                <Text className="text-white font-bold text-sm">🛑 Emergency Stop</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Done phase ────────────────────────────────── */}
          {phase === 'done' && (
            <View className="items-center py-6">
              <Text className="text-5xl mb-4">✅</Text>
              <Text className="text-xl font-bold text-[#2E241B] mb-1">All Done!</Text>
              <Text className="text-sm text-[#7D6E60] text-center mb-6">
                {jobs.length} patient{jobs.length !== 1 ? 's' : ''} dispensed ({totalTablets} doses)
              </Text>
              <TouchableOpacity onPress={onClose} className="bg-[#C96B1A] rounded-2xl px-10 py-3.5">
                <Text className="text-white font-bold text-base">Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Error phase ───────────────────────────────── */}
          {phase === 'error' && (
            <View className="items-center py-6">
              <Text className="text-5xl mb-4">❌</Text>
              <Text className="text-xl font-bold text-[#2E241B] mb-2">Dispense Failed</Text>
              <View className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 w-full">
                <Text className="text-sm text-red-700 text-center">{errorMsg || 'An error occurred. Check the machine and try again.'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="bg-[#C96B1A] rounded-2xl px-10 py-3.5">
                <Text className="text-white font-bold text-base">Close</Text>
              </TouchableOpacity>
            </View>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function WardDetailScreen() {
  const router = useRouter()
  const { id, label } = useLocalSearchParams<{ id: string; label?: string }>()
  const screenWidth = Dimensions.get('window').width
  const summaryFrameWidth = Math.min(SUMMARY_FRAME_WIDTH, screenWidth - 16)
  const summaryFrameLeft = (screenWidth - summaryFrameWidth) / 2
  const { user } = useAuthStore()
  const {
    patients,
    fetchPatients,
    urgentPatientIds,
    toggleUrgent,
    loading: patientLoading,
  } = usePatientStore()
  const {
    scheduleGroups,
    fetchSchedule,
    loading: scheduleLoading,
  } = useMedicationStore()

  const [resolvedWardLabel, setResolvedWardLabel] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('patients')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('urgency')
  const [activeTimeSlot, setActiveTimeSlot] = useState<MealTime>('noon')
  const [visiblePatients, setVisiblePatients] = useState(5)
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set())
  const [dispensedExpanded, setDispensedExpanded] = useState(false)
  const [dispenseSessions, setDispenseSessions] = useState<DispenseSessionsRow[]>([])
  const [dispenseItems, setDispenseItems] = useState<DispenseItemsRow[]>([])
  const [dispenseLoading, setDispenseLoading] = useState(false)

  // Dispense machine state
  const [machineStatus, setMachineStatus]   = useState<MachineStatus | null>(null)
  const [checkingMachine, setCheckingMachine] = useState(false)
  const [showDispenseModal, setShowDispenseModal] = useState(false)
  const [dispenseJobs, setDispenseJobs]     = useState<DispenseJob[]>([])
  const dispenseEventsRef = useRef<DispenseProgressEvent[]>([])

  const routeWardId = typeof id === 'string' ? id : ''
  const effectiveWardId = resolveWardId(routeWardId, user?.ward_id)
  const wardLabel = resolvedWardLabel ?? label ?? formatWardLabel(routeWardId || effectiveWardId)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    async function resolveLabel() {
      const [{ data: patientRows }, { data: caregiverRows }] = await Promise.all([
        supabase.from('patients').select('ward_id').not('ward_id', 'is', null),
        supabase.from('caregivers').select('ward_id').not('ward_id', 'is', null),
      ])
      const allIds = [
        ...(patientRows ?? []).map((r) => r.ward_id as string),
        ...(caregiverRows ?? []).map((r) => r.ward_id as string),
      ].filter(Boolean)
      const sorted = [...new Set(allIds)].sort()
      const index = sorted.indexOf(effectiveWardId)
      if (index >= 0) setResolvedWardLabel(`Ward ${String.fromCharCode(65 + index)}`)
    }
    if (effectiveWardId) resolveLabel()
  }, [effectiveWardId])

  const fetchDispenseData = useCallback(async () => {
    if (!effectiveWardId || USE_MOCK) return

    setDispenseLoading(true)
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('dispense_sessions')
        .select('id, patient_id, initiated_by, ward_id, session_date, status, created_at, updated_at')
        .eq('ward_id', effectiveWardId)
        .like('session_date', `${today}%`)

      if (sessionsError) throw sessionsError

      const sessionIds = (sessions ?? []).map((session) => session.id)
      if (sessionIds.length === 0) {
        setDispenseSessions([])
        setDispenseItems([])
        setDispenseLoading(false)
        return
      }

      const { data: items, error: itemsError } = await supabase
        .from('dispense_items')
        .select('id, session_id, patient_id, medicine_id, slot_index, meal_time, quantity, status, dispensed_at, error_message, created_at')
        .in('session_id', sessionIds)

      if (itemsError) throw itemsError

      setDispenseSessions(sessions ?? [])
      setDispenseItems(items ?? [])
    } catch {
      setDispenseSessions([])
      setDispenseItems([])
    } finally {
      setDispenseLoading(false)
    }
  }, [effectiveWardId, today])

  useEffect(() => {
    if (!effectiveWardId || USE_MOCK) return

    Promise.all([
      fetchPatients(effectiveWardId),
      fetchSchedule(effectiveWardId, today),
      fetchDispenseData(),
    ]).catch(() => {
      // Leave route-local visual fallback active if any request fails.
    })
  }, [effectiveWardId, fetchDispenseData, fetchPatients, fetchSchedule, today])

  useEffect(() => {
    setVisiblePatients(5)
  }, [searchQuery, sortMode, activeTab, routeWardId])

  const allItems = useMemo(
    () => scheduleGroups.flatMap((group) => group.items),
    [scheduleGroups],
  )

  const patientMetaById = useMemo(() => {
    const map = new Map<string, PatientMeta>()

    patients.forEach((patient: PatientsRow) => {
      if (effectiveWardId && patient.ward_id !== effectiveWardId) return
      map.set(patient.id, {
        id: patient.id,
        name: patient.name,
        room: patient.room_number,
        dateOfBirth: patient.date_of_birth,
      })
    })

    allItems.forEach((item) => {
      if (map.has(item.patient_id)) return
      map.set(item.patient_id, {
        id: item.patient_id,
        name: item.patient_name,
        room: item.room_number,
        dateOfBirth: null,
      })
    })

    return map
  }, [allItems, effectiveWardId, patients])

  const focusItems = useMemo(
    () => allItems.filter((item) => item.meal_time === activeTimeSlot),
    [activeTimeSlot, allItems],
  )

  const livePatientCards = useMemo<WardPatientCard[]>(() => {
    const cards: WardPatientCard[] = []

    patientMetaById.forEach((meta) => {
      const patientFocusItems = focusItems.filter((item) => item.patient_id === meta.id)
      const patientDailyItems = allItems.filter((item) => item.patient_id === meta.id)
      const statusScope = patientFocusItems.length > 0 ? patientFocusItems : patientDailyItems
      const quantityScope = patientFocusItems.length > 0 ? patientFocusItems : patientDailyItems
      const badges: PatientBadge[] = []

      const hasPending = statusScope.some((item) => item.status !== 'confirmed')
      const manuallyUrgent = Boolean(urgentPatientIds[meta.id])
      if (hasPending || manuallyUrgent) {
        badges.push('urgent')
      } else if (statusScope.length > 0) {
        badges.push('dispensed')
      }

      cards.push({
        id: meta.id,
        name: meta.name,
        room: meta.room ?? 'A-101',
        age: getAge(meta.dateOfBirth),
        tablets: quantityScope.reduce((sum, item) => sum + item.dose_quantity, 0),
        badges,
      })
    })

    return cards
  }, [allItems, focusItems, patientMetaById, urgentPatientIds])

  const usingDemoPatients = livePatientCards.length === 0 && allItems.length === 0 && patients.length === 0
  const patientCards = usingDemoPatients ? DEMO_PATIENTS : livePatientCards

  const sortedFilteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = patientCards.filter((card) => {
      if (!query) return true
      return card.name.toLowerCase().includes(query) || card.room.toLowerCase().includes(query)
    })

    return [...filtered].sort((left, right) => {
      if (sortMode === 'room') {
        return roomSortValue(left.room).localeCompare(roomSortValue(right.room))
      }

      if (sortMode === 'urgency') {
        const priorityDelta = badgePriority(left) - badgePriority(right)
        if (priorityDelta !== 0) return priorityDelta
        return left.name.localeCompare(right.name)
      }

      return left.name.localeCompare(right.name)
    })
  }, [patientCards, searchQuery, sortMode])

  const visiblePatientCards = sortedFilteredPatients.slice(0, visiblePatients)
  const canSeeMore = visiblePatients < sortedFilteredPatients.length

  const slotPatientIds = new Set(focusItems.map((item) => item.patient_id))
  const successfulPatientIds = new Set(
    [...slotPatientIds].filter((patientId) => {
      const itemsForPatient = focusItems.filter((item) => item.patient_id === patientId)
      return itemsForPatient.length > 0 && itemsForPatient.every((item) => item.status === 'confirmed')
    }),
  )

  const liveStatPatients = patientMetaById.size
  const usingDemoStats = liveStatPatients === 0 && focusItems.length === 0
  const statPatients = usingDemoStats ? 16 : liveStatPatients
  const statSuccessful = usingDemoStats ? 12 : successfulPatientIds.size
  const statPending = usingDemoStats ? 4 : Math.max(statPatients - statSuccessful, 0)

  const tableDispense = useMemo<DispenseDataset>(() => {
    if (dispenseSessions.length === 0 || dispenseItems.length === 0) {
      return { pending: [], dispensed: [], dispensedCount: 0, source: 'tables' }
    }

    const sessionIds = new Set(dispenseSessions.map((session) => session.id))
    const pending = new Map<string, number>()
    const dispensed = new Map<string, number>()

    dispenseItems.forEach((item) => {
      if (!sessionIds.has(item.session_id)) return
      const mealTime = normalizeMealTime(item.meal_time)
      if (mealTime !== activeTimeSlot) return

      if (item.status === 'dispensed') {
        dispensed.set(item.patient_id, (dispensed.get(item.patient_id) ?? 0) + item.quantity)
      } else {
        pending.set(item.patient_id, (pending.get(item.patient_id) ?? 0) + item.quantity)
      }
    })

    return {
      pending: createDispenseRows(pending, patientMetaById),
      dispensed: createDispenseRows(dispensed, patientMetaById),
      dispensedCount: dispensed.size,
      source: 'tables',
    }
  }, [activeTimeSlot, dispenseItems, dispenseSessions, patientMetaById])

  const scheduleDispense = useMemo<DispenseDataset>(() => {
    const pending = new Map<string, number>()
    const dispensed = new Map<string, number>()

    focusItems.forEach((item: ScheduleItem) => {
      if (item.status === 'confirmed') {
        dispensed.set(item.patient_id, (dispensed.get(item.patient_id) ?? 0) + item.dose_quantity)
      } else {
        pending.set(item.patient_id, (pending.get(item.patient_id) ?? 0) + item.dose_quantity)
      }
    })

    return {
      pending: createDispenseRows(pending, patientMetaById),
      dispensed: createDispenseRows(dispensed, patientMetaById),
      dispensedCount: dispensed.size,
      source: 'schedule',
    }
  }, [focusItems, patientMetaById])

  const activeDispense = useMemo<DispenseDataset>(() => {
    if (tableDispense.pending.length > 0 || tableDispense.dispensed.length > 0) return tableDispense
    if (scheduleDispense.pending.length > 0 || scheduleDispense.dispensed.length > 0) return scheduleDispense
    return {
      pending: DEMO_DISPENSE_PENDING,
      dispensed: DEMO_DISPENSED,
      dispensedCount: 14,
      source: 'demo',
    }
  }, [scheduleDispense, tableDispense])

  useEffect(() => {
    setSelectedPatients((previous) => {
      const allowedIds = new Set(activeDispense.pending.map((patient) => patient.id))
      const next = new Set([...previous].filter((patientId) => allowedIds.has(patientId)))
      return next
    })
  }, [activeDispense.pending, activeTimeSlot])

  const initialLoading = !USE_MOCK
    && patientLoading
    && scheduleLoading
    && dispenseLoading
    && patients.length === 0
    && allItems.length === 0

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F2EA] items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#F1A44F" />
      </SafeAreaView>
    )
  }

  const handleToggleSelectedPatient = (patientId: string) => {
    setSelectedPatients((previous) => {
      const next = new Set(previous)
      if (next.has(patientId)) next.delete(patientId)
      else next.add(patientId)
      return next
    })
  }

  const handleCycleSort = () => {
    const currentIndex = SORT_META.indexOf(sortMode)
    const nextMode = SORT_META[(currentIndex + 1) % SORT_META.length]
    setSortMode(nextMode)
  }

  // ── Dispense trigger flow ──────────────────────────────────────────────────

  const checkMachineAndOpen = async () => {
    if (selectedPatients.size === 0) {
      Alert.alert('No patients selected', 'Select at least one patient before dispensing.')
      return
    }

    setCheckingMachine(true)
    const status = await getMachineStatus()
    setMachineStatus(status)
    setCheckingMachine(false)

    if (status.state !== 'ready') {
      Alert.alert(
        'Machine not ready',
        `Status: ${status.state}\n${status.message}\n\nPlease check the dispenser before proceeding.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed anyway', onPress: buildAndOpenModal },
        ],
      )
      return
    }
    buildAndOpenModal()
  }

  const buildAndOpenModal = async () => {
    // Look up cabinet_slots to find which physical slot holds each patient's medicine
    const selectedIds = [...selectedPatients]
    const pendingForSlot = activeDispense.pending.filter((c) => selectedIds.includes(c.id))

    // Fetch patient prescriptions + cabinet slots for selected patients
    const { data: prescriptions } = await supabase
      .from('patient_prescriptions')
      .select('patient_id, medicine_id, dose_quantity')
      .in('patient_id', selectedIds)
      .eq('is_active', true)
      .contains('meal_times', [activeTimeSlot])

    const medicineIds = [...new Set((prescriptions ?? []).map((p) => p.medicine_id))]

    const { data: slots } = await supabase
      .from('cabinet_slots')
      .select('medicine_id, cabinet_position')
      .in('medicine_id', medicineIds)

    const slotByMedicine = new Map<string, number>()
    for (const s of slots ?? []) {
      if (s.medicine_id) slotByMedicine.set(s.medicine_id, s.cabinet_position)
    }

    // Build ordered job list — one job per patient (first medicine found)
    const jobs: DispenseJob[] = pendingForSlot.map((card) => {
      const rx = (prescriptions ?? []).find((p) => p.patient_id === card.id)
      const cabinet = rx ? (slotByMedicine.get(rx.medicine_id) ?? 1) : 1
      return {
        patientId:   card.id,
        patientName: card.name,
        room:        card.room,
        cabinet,
        tablets:     rx?.dose_quantity ?? card.tablets,
      }
    })

    setDispenseJobs(jobs)
    dispenseEventsRef.current = []
    setShowDispenseModal(true)
  }

  const runDispense = async () => {
    const { data: session, error: sessionError } = await supabase
      .from('dispense_sessions')
      .insert({
        patient_id:  dispenseJobs[0]?.patientId ?? '',
        ward_id:     effectiveWardId,
        initiated_by: user?.id ?? null,
        session_date: new Date().toISOString(),
        status:      'in_progress',
      })
      .select('id')
      .single()

    if (sessionError) throw sessionError

    await runDispenseSequence(
      dispenseJobs.map((j) => ({ cabinet: j.cabinet, patientName: j.patientName })),
      (event) => {
        dispenseEventsRef.current = [...dispenseEventsRef.current, event]
        // Trigger re-render by updating a state value via the event stream
        setDispenseJobs((prev) => [...prev])
      },
    )

    // Log to medication_logs + dispense_items, and decrement inventory for each dispensed patient
    const today = new Date().toISOString()
    for (let i = 0; i < dispenseJobs.length; i += 1) {
      const job = dispenseJobs[i]
      const rx = await supabase
        .from('patient_prescriptions')
        .select('id, medicine_id')
        .eq('patient_id', job.patientId)
        .eq('is_active', true)
        .contains('meal_times', [activeTimeSlot])
        .limit(1)
        .maybeSingle()

      if (!rx.data) continue

      await supabase.from('medication_logs').insert({
        prescription_id: rx.data.id,
        patient_id:      job.patientId,
        medicine_id:     rx.data.medicine_id,
        caregiver_id:    user?.id ?? '',
        meal_time:       activeTimeSlot,
        status:          'confirmed',
        method:          'normal',
        administered_at: today,
      })

      if (session?.id) {
        await supabase.from('dispense_items').insert({
          session_id:    session.id,
          patient_id:    job.patientId,
          medicine_id:   rx.data.medicine_id,
          slot_index:    job.cabinet,
          meal_time:     activeTimeSlot,
          quantity:      job.tablets,
          status:        'dispensed',
          dispensed_at:  today,
        })
      }

      const { data: slotRow } = await supabase
        .from('cabinet_slots')
        .select('id, quantity_remaining')
        .eq('medicine_id', rx.data.medicine_id)
        .eq('cabinet_position', job.cabinet)
        .limit(1)
        .maybeSingle()

      if (slotRow?.id) {
        const remaining = Math.max(0, (slotRow.quantity_remaining ?? 0) - job.tablets)
        await supabase
          .from('cabinet_slots')
          .update({ quantity_remaining: remaining })
          .eq('id', slotRow.id)
      }
    }

    // Mark session complete
    if (session?.id) {
      await supabase
        .from('dispense_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id)
    }

    // Refresh data
    setSelectedPatients(new Set())
    await fetchDispenseData()
  }

  return (
    <View className="flex-1 bg-[#F7F2EA]">
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView className="flex-1 bg-[#F7F2EA]" edges={['top', 'left', 'right']}>
        <View className="flex-1">
          {/* Background extends to cover header + stats + tabs */}
          <Image
            source={HeroSectionImg}
            style={{ position: 'absolute', top: 0, left: 0, width: screenWidth, height: 330 }}
            resizeMode="cover"
          />
          <View className="relative h-[220px]">

            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute left-5 top-5 w-10 h-10 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={26} color="#313131" />
            </TouchableOpacity>

            <View className="absolute left-6 right-6 bottom-[100px]">
              <Text className="text-[30px] leading-[36px] font-bold text-[#303030]">
                {wardLabel}
              </Text>
              <View className="flex-row items-center mt-2">
                <Ionicons name="layers-outline" size={16} color="#424242" />
                <Text className="text-[13px] leading-[18px] text-[#404040] ml-2">
                  Building 1, Floor 2 - Somying
                </Text>
              </View>
            </View>

            <View
              style={[CARD_SHADOW, { position: 'absolute', left: summaryFrameLeft, width: summaryFrameWidth, bottom: -40, borderRadius: 24, backgroundColor: '#FFFFFF', padding: 10 }]}
            >
              <LinearGradient
                colors={['#F1F1F1', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: '#EDE4D8' }}
              >
                <SummaryStat value={statPatients} label="Patients" borderRight />
                <SummaryStat value={statSuccessful} label="Successfully" borderRight />
                <SummaryStat value={statPending} label="Pending" />
              </LinearGradient>
            </View>
          </View>

          {/* Tab bar */}
          <View className="flex-row mt-[52px] bg-white/50">
            <InternalTab
              active={activeTab === 'patients'}
              icon="person-add-outline"
              label="Patients"
              onPress={() => setActiveTab('patients')}
            />
            <InternalTab
              active={activeTab === 'dispense'}
              icon="medical-outline"
              label="Dispense"
              onPress={() => setActiveTab('dispense')}
            />
          </View>

          {activeTab === 'patients' ? (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 36 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="bg-white border-t  border-[#EAEAEA] px-4 py-3 flex-row items-center mb-4">
                <View className="flex-1 rounded-[16px] border border-[#E2E0DB] bg-[#FAFAFA] px-3 py-2.5 flex-row items-center mr-3">
                  <Ionicons name="search-outline" size={18} color="#343434" />
                  <TextInput
                    className="flex-1 ml-2.5 text-[14px] leading-[20px] text-[#2E2E2E]"
                    placeholder="Search Patient Name"
                    placeholderTextColor="#8B94A4"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleCycleSort}
                  className="w-11 h-11 rounded-full border border-[#E2E0DB] bg-white items-center justify-center"
                >
                  <Ionicons name="swap-vertical" size={20} color="#343434" />
                </TouchableOpacity>
              </View>

              {visiblePatientCards.length > 0 ? (
                visiblePatientCards.map((card) => (
                  <PatientRow
                    key={card.id}
                    card={card}
                    onPress={() => {
                      if (!card.isFallback) router.push(`/patient/${card.id}`)
                    }}
                    onMore={() => {
                      if (card.isFallback) return
                      const isUrgent = Boolean(urgentPatientIds[card.id])
                      Alert.alert(card.name, 'Choose an action for this patient.', [
                        { text: 'View profile', onPress: () => router.push(`/patient/${card.id}`) },
                        {
                          text: isUrgent ? 'Clear urgent flag' : 'Mark urgent',
                          onPress: () => {
                            const nowUrgent = toggleUrgent(card.id)
                            Alert.alert(
                              card.name,
                              nowUrgent
                                ? 'Patient marked as urgent.'
                                : 'Urgent flag cleared.',
                            )
                          },
                        },
                        {
                          text: 'Daily family update',
                          onPress: () =>
                            router.push({
                              pathname: '/daily-update',
                              params: { patientId: card.id, patientName: card.name },
                            }),
                        },
                        {
                          text: '🚨 Emergency: Notify family via LINE',
                          onPress: () =>
                            router.push({
                              pathname: '/notify-family',
                              params: { patientId: card.id, patientName: card.name },
                            }),
                        },
                        {
                          text: 'Manage family contacts',
                          onPress: () =>
                            router.push({
                              pathname: '/family-contacts',
                              params: { patientId: card.id, patientName: card.name },
                            }),
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ])
                    }}
                  />
                ))
              ) : (
                <EmptyCard
                  icon="search"
                  title="No matching patients"
                  subtitle="Try a different name or room number."
                />
              )}

              {sortedFilteredPatients.length > 5 ? (
                <TouchableOpacity
                  onPress={() => setVisiblePatients((current) => (canSeeMore ? current + 5 : 5))}
                  className="items-center justify-center py-4"
                >
                  <Text className="text-[14px] leading-[20px] text-[#2F2F2F]">
                    {canSeeMore ? '+ See More' : 'Show Less'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          ) : (
            <View className="flex-1">
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 36 }}
                showsVerticalScrollIndicator={false}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-6"
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                >
                  {SLOT_META.map((slot) => {
                    const isActive = activeTimeSlot === slot.key
                    const completed = !isActive && activeDispense.source !== 'demo' && (() => {
                      const slotItems = allItems.filter((item) => item.meal_time === slot.key)
                      return slotItems.length > 0 && slotItems.every((item) => item.status === 'confirmed')
                    })()
                    return (
                      <TimeChip
                        key={slot.key}
                        label={slot.label}
                        active={isActive}
                        completed={completed}
                        onPress={() => setActiveTimeSlot(slot.key)}
                      />
                    )
                  })}
                </ScrollView>

                {activeDispense.pending.length > 0 ? (
                  activeDispense.pending.map((card) => (
                    <DispenseRow
                      key={card.id}
                      card={card}
                      selected={selectedPatients.has(card.id)}
                      onToggle={() => handleToggleSelectedPatient(card.id)}
                    />
                  ))
                ) : (
                  <EmptyCard
                    icon="checkmark-done-circle"
                    title="Nothing left to dispense"
                    subtitle="All queued patients for this time slot are already dispensed."
                  />
                )}
              </ScrollView>

              {/* ── Bottom action area ─────────────────────── */}
              <View className="px-4 pb-4 gap-3">

                {/* Machine status chip */}
                {machineStatus && (
                  <View className={`flex-row items-center px-4 py-2.5 rounded-2xl ${
                    machineStatus.state === 'ready'
                      ? 'bg-green-50 border border-green-100'
                      : 'bg-red-50 border border-red-100'
                  }`}>
                    <View className={`w-2 h-2 rounded-full mr-2 ${
                      machineStatus.state === 'ready' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <Text className={`text-xs font-semibold ${
                      machineStatus.state === 'ready' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      Machine: {machineStatus.state}
                    </Text>
                    {machineStatus.message ? (
                      <Text className="text-xs text-gray-500 ml-2 flex-1" numberOfLines={1}>
                        {machineStatus.message}
                      </Text>
                    ) : null}
                  </View>
                )}

                {/* Dispensed summary collapsible */}
                <TouchableOpacity
                  onPress={() => setDispensedExpanded((c) => !c)}
                  activeOpacity={0.9}
                  className="bg-[#DDFBF3] rounded-[20px] px-4 py-3"
                >
                  <View className="flex-row items-center">
                    <View className="w-7 h-7 rounded-full bg-[#18C79A] items-center justify-center mr-3">
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                    <Text className="flex-1 text-[15px] font-semibold text-[#16B88D]">
                      {activeDispense.dispensedCount} dispensed this slot
                    </Text>
                    <Ionicons
                      name={dispensedExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#179D7D"
                    />
                  </View>
                  {dispensedExpanded && activeDispense.dispensed.length > 0 && (
                    <View className="mt-3 pt-3 border-t border-[#CBEDE3]">
                      {activeDispense.dispensed.map((p) => (
                        <View key={p.id} className="flex-row items-center py-1.5">
                          <Ionicons name="person-circle-outline" size={18} color="#179D7D" />
                          <Text className="text-sm text-[#2F2F2F] ml-2 flex-1" numberOfLines={1}>{p.name}</Text>
                          <Text className="text-xs text-[#6B7280]">Room {p.room}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Start dispense button */}
                <TouchableOpacity
                  onPress={checkMachineAndOpen}
                  disabled={checkingMachine || selectedPatients.size === 0}
                  activeOpacity={0.85}
                  className={`rounded-[22px] py-4 items-center flex-row justify-center ${
                    selectedPatients.size === 0
                      ? 'bg-[#E8D5C4]'
                      : 'bg-[#C96B1A]'
                  }`}
                >
                  {checkingMachine ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={18} color="white" />
                      <Text className="text-white font-bold text-base ml-2">
                        {selectedPatients.size === 0
                          ? 'Select patients to dispense'
                          : `Dispense for ${selectedPatients.size} patient${selectedPatients.size !== 1 ? 's' : ''}`}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

              </View>
            </View>
          )}
        </View>

        <BottomNav
          onHome={() => router.replace('/(tabs)')}
          onWard={() => router.replace('/(tabs)/patients')}
          onProfile={() => router.replace('/(tabs)/settings')}
        />

        <DispenseModal
          visible={showDispenseModal}
          jobs={dispenseJobs}
          timeLabel={SLOT_META.find((s) => s.key === activeTimeSlot)?.label ?? activeTimeSlot}
          onClose={() => {
            setShowDispenseModal(false)
            fetchDispenseData()
          }}
          onConfirm={runDispense}
        />
      </SafeAreaView>
    </View>
  )
}
