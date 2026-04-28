import type { Ionicons } from '@expo/vector-icons'
import type { LogMethod, LogStatus, MealTime } from '../../types/database'

export type DetailTab = 'medications' | 'appointments' | 'device' | 'history'
export type WarningTone = 'critical' | 'warning' | null

export interface DisplayMedication {
  id: string
  medicineId?: string | null
  medicineName: string
  doseQuantity: number
  dosageForm: string | null
  instructions: string | null
  mealTimes: MealTime[]
  daysLeft: number | null
  endDateLabel: string | null
  warningTone: WarningTone
  quantityRemaining?: number | null
  initialQuantity?: number | null
}

export interface DetailPanelItem {
  id: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  meta: string
  badge: string
  badgeTone: 'neutral' | 'success' | 'warning'
}

export interface MedicationHistoryEntry {
  id: string
  administered_at: string
  meal_time: MealTime
  status: LogStatus
  method: LogMethod
  refusal_reason: string | null
  notes: string | null
  medicine_name: string
  medicine_strength: string | null
}

export type TabDef = {
  key: DetailTab
  label: string
  Icon: React.FC<{ width?: number; height?: number; color?: string }>
}

export const DISPLAY_MEALS: MealTime[] = ['morning', 'noon', 'evening', 'bedtime']
export const MEAL_LABELS: Record<MealTime, string> = {
  morning: 'Morning',
  noon: 'Noon',
  evening: 'Evening',
  bedtime: 'Night',
}

export function buildMedicineName(name: string, strength: string | null): string {
  return strength ? `${name} ${strength}` : name
}
