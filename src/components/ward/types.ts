import type { MealTime } from '../../types/database'

export type TabType = 'patients' | 'dispense'
export type SortMode = 'name' | 'room' | 'urgency'
export type PatientBadge = 'urgent' | 'dispensed' | 'low_medication'

export interface PatientMeta {
  id: string
  name: string
  room: string | null
  dateOfBirth: string | null
}

export interface WardPatientCard {
  id: string
  name: string
  room: string
  age: number | null
  tablets: number
  badges: PatientBadge[]
  isFallback?: boolean
}

export interface DispenseCardData {
  id: string
  name: string
  room: string
  tablets: number
  isFallback?: boolean
}

export interface DispenseDataset {
  pending: DispenseCardData[]
  dispensed: DispenseCardData[]
  dispensedCount: number
  source: 'tables' | 'schedule' | 'demo'
}

export interface DispenseJob {
  patientId: string
  patientName: string
  room: string
  cabinet: number
  tablets: number
}

export type DispenseModalPhase = 'confirm' | 'running' | 'done' | 'error'

export interface WardSummaryCard {
  id: string
  title: string
  subtitle: string
  doseLabel: string
  patientCount: number
  successCount: number
  pendingCount: number
  lowStockCount: number
  fillCompletionLabel: string
  live: boolean
}

export const CARD_SHADOW = {
  shadowColor: '#D5C3AF',
  shadowOpacity: 0.28,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 22,
  elevation: 6,
}

export const SLOT_META: Array<{ key: MealTime; label: string }> = [
  { key: 'morning', label: 'Morning' },
  { key: 'noon',    label: 'Noon' },
  { key: 'evening', label: 'Evening' },
  { key: 'bedtime', label: 'Night' },
]

export const SORT_META: SortMode[] = ['name', 'room', 'urgency']

export const DEMO_PATIENTS: WardPatientCard[] = [
  { id: 'demo-p1', name: 'Mrs. Somsri Phakrammongkol', room: 'A-101', age: 79, tablets: 9,  badges: ['urgent'], isFallback: true },
  { id: 'demo-p2', name: 'Mrs. Somchai Rungreang',     room: 'A-102', age: 79, tablets: 12, badges: ['urgent'], isFallback: true },
  { id: 'demo-p3', name: 'Mr. Mana Jai',               room: 'B-203', age: 69, tablets: 5,  badges: ['dispensed'], isFallback: true },
  { id: 'demo-p4', name: 'Mrs. Dararat Prasartngam',   room: 'B-204', age: 80, tablets: 11, badges: ['urgent', 'low_medication'], isFallback: true },
  { id: 'demo-p5', name: 'Mrs. Kanya Singkow',         room: 'B-205', age: 67, tablets: 12, badges: ['urgent'], isFallback: true },
]

export const DEMO_DISPENSE_PENDING: DispenseCardData[] = [
  { id: 'demo-d1', name: 'Mrs. Somchai Rungreang', room: 'B-203', tablets: 5, isFallback: true },
  { id: 'demo-d2', name: 'Mrs. Kanya Singkow',     room: 'B-203', tablets: 5, isFallback: true },
]

export const DEMO_DISPENSED: DispenseCardData[] = [
  { id: 'demo-done-1', name: 'Mr. Mana Jai',             room: 'B-203', tablets: 5,  isFallback: true },
  { id: 'demo-done-2', name: 'Mrs. Dararat Prasartngam', room: 'B-204', tablets: 11, isFallback: true },
]
