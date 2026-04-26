/**
 * src/types/database.ts
 * Type definitions matching the actual Supabase schema.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'caregiver' | 'nurse' | 'admin'

export type MealTime = 'morning' | 'noon' | 'evening' | 'bedtime'

export type LogStatus = 'confirmed' | 'refused' | 'skipped'

export type LogMethod = 'normal' | 'crushed' | 'feeding_tube'

export type NotificationChannel = 'push' | 'line'

export type NotificationStatus = 'sent' | 'delivered' | 'failed'

export type RecipientType = 'caregiver' | 'family'

export type ChangeType = 'added' | 'modified' | 'discontinued'

export type DispenseStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type DispenseItemStatus = 'queued' | 'dispensed' | 'failed' | 'skipped'

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: wards
// ─────────────────────────────────────────────────────────────────────────────

export interface WardsRow {
  id: string
  name: string
  floor: string | null
  capacity: number | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: users  (caregivers in app logic)
// ─────────────────────────────────────────────────────────────────────────────

export interface UsersRow {
  id: string          // same as auth.users id
  email: string
  name: string
  phone: string | null
  role: UserRole
  ward_id: string | null
  created_at: string
}

export interface UsersInsert {
  id: string
  email: string
  name: string
  phone?: string | null
  role?: UserRole
  ward_id?: string | null
  created_at?: string
}

export interface UsersUpdate {
  email?: string
  name?: string
  phone?: string | null
  role?: UserRole
  ward_id?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: patients
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientsRow {
  id: string
  name: string
  photo_url: string | null
  room_number: string | null
  ward_id: string
  status: string
  date_of_birth: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PatientsInsert {
  id?: string
  name: string
  photo_url?: string | null
  room_number?: string | null
  ward_id: string
  status?: string
  date_of_birth?: string | null
  notes?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: medicines
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicinesRow {
  id: string
  name: string
  category: string | null
  dosage_form: string | null
  strength: string | null
  description: string | null
  side_effects: string | null
  storage_instructions: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: patient_prescriptions
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientPrescriptionsRow {
  id: string
  patient_id: string
  medicine_id: string
  dose_quantity: number
  meal_times: MealTime[]
  start_date: string
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface PatientPrescriptionsInsert {
  id?: string
  patient_id: string
  medicine_id: string
  dose_quantity?: number
  meal_times: MealTime[]
  start_date: string
  end_date?: string | null
  is_active?: boolean
  notes?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: medication_logs
// ─────────────────────────────────────────────────────────────────────────────

export interface MedicationLogsRow {
  id: string
  prescription_id: string
  patient_id: string
  medicine_id: string
  caregiver_id: string
  administered_at: string
  meal_time: MealTime
  status: LogStatus
  method: LogMethod
  refusal_reason: string | null
  conflict_flag: boolean
  notes: string | null
  created_at: string
}

export interface MedicationLogsInsert {
  id?: string
  prescription_id: string
  patient_id: string
  medicine_id: string
  caregiver_id: string
  administered_at?: string
  meal_time: MealTime
  status: LogStatus
  method?: LogMethod
  refusal_reason?: string | null
  conflict_flag?: boolean
  notes?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: cabinet_slots
// ─────────────────────────────────────────────────────────────────────────────

export interface CabinetSlotsRow {
  id: string
  patient_id: string | null
  medicine_id: string | null
  cabinet_position: number
  partition: string
  quantity_remaining: number
  expiry_date: string | null
  created_at: string
  updated_at: string
  initial_quantity: number | null
  received_date: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: dispense_sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface DispenseSessionsRow {
  id: string
  patient_id: string
  initiated_by: string | null
  ward_id: string | null
  session_date: string
  status: DispenseStatus
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: dispense_items
// ─────────────────────────────────────────────────────────────────────────────

export interface DispenseItemsRow {
  id: string
  session_id: string
  patient_id: string
  medicine_id: string
  slot_index: number
  meal_time: string
  quantity: number
  status: DispenseItemStatus
  dispensed_at: string | null
  error_message: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: dispenser_slots
// ─────────────────────────────────────────────────────────────────────────────

export interface DispenserSlotsRow {
  id: string
  session_id: string
  slot_index: number
  medicine_id: string
  patient_id: string
  dose_quantity: number
  meal_times: string[]
  confirmed: boolean
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: shift_handovers
// ─────────────────────────────────────────────────────────────────────────────

export interface ShiftHandoversRow {
  id: string
  ward_id: string
  caregiver_id: string
  shift_start: string
  shift_end: string
  summary_json: Record<string, unknown>
  acknowledged_at: string | null
  acknowledged_by_id: string | null
  shift_notes: string | null
  created_at: string
}

export interface ShiftHandoversInsert {
  id?: string
  ward_id: string
  caregiver_id: string
  shift_start: string
  shift_end: string
  summary_json?: Record<string, unknown>
  acknowledged_at?: string | null
  acknowledged_by_id?: string | null
  shift_notes?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: family_contacts
// ─────────────────────────────────────────────────────────────────────────────

export interface FamilyContactsRow {
  id: string
  patient_id: string
  name: string
  relationship: string | null
  line_user_id: string | null
  phone: string | null
  notification_preferences: Record<string, unknown>
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: notification_logs
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationLogsRow {
  id: string
  recipient_type: RecipientType
  recipient_id: string
  channel: NotificationChannel
  event_type: string
  payload: Record<string, unknown>
  status: NotificationStatus
  sent_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE: prescription_changes
// ─────────────────────────────────────────────────────────────────────────────

export interface PrescriptionChangesRow {
  id: string
  prescription_id: string
  change_type: ChangeType
  previous_json: Record<string, unknown> | null
  new_json: Record<string, unknown> | null
  changed_by: string
  source_hospital: string | null
  notified_at: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE DATABASE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: { Row: UsersRow; Insert: UsersInsert; Update: UsersUpdate }
      patients: { Row: PatientsRow; Insert: PatientsInsert; Update: Partial<PatientsInsert> }
      medicines: { Row: MedicinesRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      patient_prescriptions: { Row: PatientPrescriptionsRow; Insert: PatientPrescriptionsInsert; Update: Partial<PatientPrescriptionsInsert> }
      medication_logs: { Row: MedicationLogsRow; Insert: MedicationLogsInsert; Update: Record<string, unknown> }
      cabinet_slots: { Row: CabinetSlotsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      dispense_sessions: { Row: DispenseSessionsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      dispense_items: { Row: DispenseItemsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      dispenser_slots: { Row: DispenserSlotsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      shift_handovers: { Row: ShiftHandoversRow; Insert: ShiftHandoversInsert; Update: Partial<ShiftHandoversInsert> }
      family_contacts: { Row: FamilyContactsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      notification_logs: { Row: NotificationLogsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      prescription_changes: { Row: PrescriptionChangesRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      wards: { Row: WardsRow; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}