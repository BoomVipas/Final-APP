/**
 * src/lib/lineNotifier.ts
 *
 * Thin client over the `line-notifier` Supabase edge function.
 * Used by app/notify-family.tsx (Workflow 12 / Workflow 15 A4) and any other
 * surface that needs to push a LINE message to a patient's family.
 *
 * The edge function reads LINE_CHANNEL_ACCESS_TOKEN from Supabase Function
 * secrets — there is no client-side path to LINE.
 */

import { supabase } from './supabase'

export type LineEventType =
  | 'stock_warning'
  | 'stock_critical'
  | 'prescription_changed'
  | 'appointment_reminder'
  | 'weekly_summary'
  | 'caregiver_message'
  | 'test_message'
  | 'daily_update'

// ─── Daily-update payload shapes (mirrors the edge-function reader) ──────────

export interface DailyVitals {
  T?: string
  P?: string
  R?: string
  BP_sys?: string
  BP_dia?: string
  O2?: string
  urine?: string
  stool?: string
}

export type MealPortion = 'all' | 'half' | 'little' | 'none'
export type MealType = 'breakfast' | 'noon' | 'evening'

export interface DailyMeal {
  meal_type: MealType
  portion: MealPortion
  food: string
}

export type ShiftLetter = 'M' | 'D' | 'N'
export type ShiftSleep = 'good' | 'restless' | 'frequent_waking' | 'no_sleep'

export interface DailyShift {
  shift_letter: ShiftLetter
  sleep: ShiftSleep
  notes: string
}

export interface DailyUpdatePayload {
  patient_name: string
  caregiver_name: string
  date_be: string  // "DD/MM/YYYY" with YYYY in Buddhist Era
  time: string     // "HH:MM"
  vitals?: DailyVitals
  meal?: DailyMeal
  shift?: DailyShift
  photo_url?: string
}

export interface LineSendResult {
  sent: number
  failed: number
  skipped: number
}

interface InvokePayload {
  patient_id: string
  event_type: LineEventType
  message_data: Record<string, unknown>
  target_contact_id?: string
}

async function invokeLineNotifier(payload: InvokePayload): Promise<LineSendResult> {
  const { data, error } = await supabase.functions.invoke<LineSendResult>('line-notifier', {
    body: payload,
  })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('line-notifier returned no result')
  return data
}

/**
 * Send a free-form caregiver message to all family contacts of a patient
 * who have a LINE user ID configured. Bypasses quiet-hours (caregiver is
 * making an explicit decision in the moment).
 */
export async function sendCaregiverMessage(args: {
  patientId: string
  patientName: string
  text: string
  senderName?: string
}): Promise<LineSendResult> {
  const trimmed = args.text.trim()
  if (!trimmed) throw new Error('Message text is required')
  if (!args.patientId) throw new Error('patientId is required')

  return invokeLineNotifier({
    patient_id: args.patientId,
    event_type: 'caregiver_message',
    message_data: {
      patient_name: args.patientName,
      sender_name: args.senderName ?? 'PILLo Caregiver',
      text: trimmed,
    },
  })
}

/**
 * Generic wrapper for the structured event types. Keeps stock-calculator and
 * future cron functions on a single typed surface.
 */
/**
 * Send the composite daily-update report (V/S, meal, shift sections — any
 * subset, plus optional photo). Bypasses quiet hours.
 */
export async function sendDailyUpdate(args: {
  patientId: string
  payload: DailyUpdatePayload
}): Promise<LineSendResult> {
  if (!args.patientId) throw new Error('patientId is required')
  if (!args.payload.vitals && !args.payload.meal && !args.payload.shift) {
    throw new Error('Daily update must include at least one section')
  }
  return invokeLineNotifier({
    patient_id: args.patientId,
    event_type: 'daily_update',
    message_data: args.payload as unknown as Record<string, unknown>,
  })
}

export async function sendStructuredEvent(args: {
  patientId: string
  eventType: Exclude<LineEventType, 'caregiver_message' | 'daily_update'>
  data: Record<string, unknown>
}): Promise<LineSendResult> {
  return invokeLineNotifier({
    patient_id: args.patientId,
    event_type: args.eventType,
    message_data: args.data,
  })
}

/**
 * Send a one-off test Flex Message to a single linked contact so the caregiver
 * can verify the LINE plumbing works end-to-end. Bypasses quiet hours.
 */
export async function sendTestMessage(args: {
  patientId: string
  contactId: string
  patientName?: string
}): Promise<LineSendResult> {
  return invokeLineNotifier({
    patient_id: args.patientId,
    event_type: 'test_message',
    target_contact_id: args.contactId,
    message_data: { patient_name: args.patientName ?? '' },
  })
}

/**
 * Builds the LINE deep-link URL that the family member opens (either by
 * scanning a QR or tapping the link in SMS). The URL:
 *   1. Prompts them to add the PILLo OA as a friend if they aren't already.
 *   2. Opens the chat with `LINK:<token>` already typed in the input.
 *   3. They tap Send. The `line-webhook` captures their userId.
 *
 * `oaBasicId` is the LINE OA's basic ID (e.g. "@123abcde"), exposed via
 * EXPO_PUBLIC_LINE_OA_BASIC_ID. The leading "@" is optional in the URL.
 */
export function buildFamilyInviteUrl(args: {
  oaBasicId: string
  linkToken: string
}): string {
  const id = args.oaBasicId.startsWith('@') ? args.oaBasicId.slice(1) : args.oaBasicId
  // LINE oaMessage takes the prefilled chat text DIRECTLY as the query string
  // (NOT as a `?text=` parameter). Anything in the form `?key=value` ends up
  // verbatim in the chat input, which is what bit us before.
  const text = encodeURIComponent(`LINK:${args.linkToken}`)
  return `https://line.me/R/oaMessage/@${id}/?${text}`
}
