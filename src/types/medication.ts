/**
 * src/types/medication.ts
 * Domain-level types for PILLo medication business logic.
 * These are NOT DB mirrors — they represent computed, aggregated, or
 * UI-specific shapes derived from the database types.
 */

import type { MealTime, MedicationLogsRow } from './database'

// ─────────────────────────────────────────────────────────────────────────────
// TIME WINDOW (F-2 — Anti-Duplicate Check)
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeWindow {
  start: Date
  end: Date
  windowMinutes: number
  scheduledAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT / DUPLICATE CHECK (F-2)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConflictCheck {
  hasConflict: boolean
  existingLog?: MedicationLogsRow
  conflictingCaregiver?: string
  checkedWindow: TimeWindow
  prescriptionId: string
  mealTime: MealTime
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCK / INVENTORY ALERTS (F-3)
// ─────────────────────────────────────────────────────────────────────────────

export interface DepletionAlert {
  patientId: string
  medicationId: string
  currentCount: number
  dailyRate: number
  estimatedDays: number
  estimatedDepletionDate: Date
  threshold: 'warning' | 'critical'
  patientName: string
  medicationName: string
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDOVER (F-1)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandoverPendingItem {
  prescriptionId: string
  patientId: string
  patientName: string
  medicationName: string
  mealTime: MealTime
}

export interface HandoverSummary {
  wardId: string
  wardName: string
  shiftStart: string
  shiftEnd: string
  pendingItems: HandoverPendingItem[]
  prescriptionChanges: PrescriptionChangeNotice[]
  activeAlerts: DepletionAlert[]
  prnMedications: PrnAdministrationRecord[]
  totalPatients: number
  fullyCoveredPatients: number
}

export interface PrescriptionChangeNotice {
  changeId: string
  patientName: string
  medicationName: string
  changeType: string
  summary: string
  effectiveDate: string
}

export interface PrnAdministrationRecord {
  logId: string
  patientName: string
  medicationName: string
  administeredAt: Date
  administeredBy: string
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// DRUG LABEL SCANNER (F-6)
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanResult {
  confidence: number
  fields: {
    medicine_name?: string
    dose_quantity?: number
    meal_times?: MealTime[]
    notes?: string
  }
  rawText: string
  requiresReview: boolean
  matchedMedicationId: string | null
  alternatives: Array<{
    medicationId: string
    medicationName: string
    similarity: number
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE NOTIFICATION (F-7)
// ─────────────────────────────────────────────────────────────────────────────

export interface LineNotificationPayload {
  lineUserId: string
  messageType: 'text' | 'flex'
  category: 'dose_administered' | 'dose_missed' | 'prescription_change' | 'stock_alert' | 'daily_summary'
  patientName: string
  eventTime: string
  details: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTION PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

export interface RealtimeChangeEvent<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: Partial<T>
  schema: string
  table: string
  commitTimestamp: string
}