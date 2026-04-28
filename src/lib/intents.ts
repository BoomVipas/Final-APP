/**
 * src/lib/intents.ts
 *
 * AI-callable intent registry. The voice assistant returns
 *   { intent_id, params }
 * and the app dispatches the user to the matching screen via this catalog —
 * no scattered router.push strings, no hardcoded if/else chains.
 *
 * Adding a new intent:
 *   1. Add the id to IntentId.
 *   2. Add an entry to INTENTS with bilingual labels + a route() builder.
 *   3. List required_params if any.
 *   The voice-assistant edge function (Workflow 17 C3) reads getIntentCatalog()
 *   into Claude's system prompt as the available tool list.
 */

import type { Router } from 'expo-router'

export type IntentId =
  | 'go_home'
  | 'go_wards'
  | 'go_settings'
  | 'open_notifications'
  | 'open_schedule'
  | 'start_handover'
  | 'view_handover_history'
  | 'open_dispensing_report'
  | 'open_scanner'
  | 'open_patient'
  | 'view_medication_history'
  | 'add_medication'
  | 'weekly_fill'
  | 'family_contacts'
  | 'notify_family'
  | 'daily_family_update'
  | 'schedule_hospital_visit'

export interface IntentDef {
  id: IntentId
  label_th: string
  label_en: string
  description: string
  required_params?: string[]
  route: (params: Record<string, string>) => {
    pathname: string
    params?: Record<string, string>
  }
}

function patientParams(
  patient_id: string,
  patient_name: string | undefined,
  idKey = 'patientId',
  nameKey = 'patientName',
): Record<string, string> {
  const out: Record<string, string> = { [idKey]: patient_id }
  if (patient_name) out[nameKey] = patient_name
  return out
}

export const INTENTS: Record<IntentId, IntentDef> = {
  go_home: {
    id: 'go_home',
    label_th: 'หน้าแรก',
    label_en: 'Home',
    description: 'Navigate to the home dashboard.',
    route: () => ({ pathname: '/(tabs)' }),
  },
  go_wards: {
    id: 'go_wards',
    label_th: 'รายชื่อวอร์ด',
    label_en: 'Wards',
    description: 'Open the ward list.',
    route: () => ({ pathname: '/(tabs)/patients' }),
  },
  go_settings: {
    id: 'go_settings',
    label_th: 'ตั้งค่า',
    label_en: 'Settings',
    description: 'Open the settings tab.',
    route: () => ({ pathname: '/(tabs)/settings' }),
  },
  open_notifications: {
    id: 'open_notifications',
    label_th: 'การแจ้งเตือน',
    label_en: 'Notifications',
    description: 'Open the notifications list.',
    route: () => ({ pathname: '/notifications' }),
  },
  open_schedule: {
    id: 'open_schedule',
    label_th: 'ตารางยาวันนี้',
    label_en: "Today's medication schedule",
    description: 'Open the medication schedule for the current day.',
    route: () => ({ pathname: '/(tabs)/schedule' }),
  },
  start_handover: {
    id: 'start_handover',
    label_th: 'เริ่มสรุปกะ',
    label_en: 'Start shift handover',
    description: 'Open the shift handover screen for the current ward.',
    route: () => ({ pathname: '/handover' }),
  },
  view_handover_history: {
    id: 'view_handover_history',
    label_th: 'ประวัติสรุปกะ',
    label_en: 'Handover history',
    description: 'View past acknowledged shift handovers.',
    route: () => ({ pathname: '/handover-history' }),
  },
  open_dispensing_report: {
    id: 'open_dispensing_report',
    label_th: 'รายงานการจ่ายยา',
    label_en: 'Dispensing report',
    description: 'Open the dispensing activity report.',
    route: () => ({ pathname: '/report' }),
  },
  open_scanner: {
    id: 'open_scanner',
    label_th: 'สแกนฉลากยา',
    label_en: 'Scan medication label',
    description: 'Open the drug-label scanner camera.',
    route: () => ({ pathname: '/scanner' }),
  },

  open_patient: {
    id: 'open_patient',
    label_th: 'เปิดข้อมูลผู้ป่วย',
    label_en: 'Open patient profile',
    description: 'Open a patient detail screen by patient_id.',
    required_params: ['patient_id'],
    route: ({ patient_id }) => ({
      pathname: '/patient/[id]',
      params: { id: patient_id },
    }),
  },
  view_medication_history: {
    id: 'view_medication_history',
    label_th: 'ประวัติการให้ยา',
    label_en: 'Medication history',
    description: 'Show past medication log entries for a patient.',
    required_params: ['patient_id'],
    route: ({ patient_id }) => ({
      pathname: '/patient/[id]',
      params: { id: patient_id, tab: 'history' },
    }),
  },
  add_medication: {
    id: 'add_medication',
    label_th: 'เพิ่มยา',
    label_en: 'Add medication',
    description: 'Open the add-medication form for a patient.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/add-medication',
      params: patientParams(patient_id, patient_name),
    }),
  },
  weekly_fill: {
    id: 'weekly_fill',
    label_th: 'เติมยารายสัปดาห์',
    label_en: 'Weekly cabinet fill',
    description: 'Start the weekly cabinet-fill workflow for a patient.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/dispense-fill/load/[patientId]',
      params: patientParams(patient_id, patient_name),
    }),
  },
  family_contacts: {
    id: 'family_contacts',
    label_th: 'จัดการญาติผู้ป่วย',
    label_en: 'Family contacts',
    description: 'Manage the LINE / phone contacts of a patient family.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/family-contacts',
      params: patientParams(patient_id, patient_name),
    }),
  },
  notify_family: {
    id: 'notify_family',
    label_th: 'แจ้งเหตุฉุกเฉินครอบครัวทาง LINE',
    label_en: 'Emergency: notify family via LINE',
    description:
      'Open the EMERGENCY LINE composer (red button, quick templates for fall / out-of-meds / condition-worsened / urgent-visit). Use only for urgent situations.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/notify-family',
      params: patientParams(patient_id, patient_name),
    }),
  },
  daily_family_update: {
    id: 'daily_family_update',
    label_th: 'รายงานครอบครัวประจำวัน',
    label_en: 'Daily family update',
    description:
      'Open the routine daily-report composer (V/S vital signs, meal portion, shift handover, optional photo). Sends a structured Flex Message to the patient family on LINE.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/daily-update',
      params: patientParams(patient_id, patient_name),
    }),
  },
  schedule_hospital_visit: {
    id: 'schedule_hospital_visit',
    label_th: 'นัดไปโรงพยาบาล',
    label_en: 'Schedule hospital visit',
    description: 'Open the hospital-visit reminder form for a patient.',
    required_params: ['patient_id'],
    route: ({ patient_id, patient_name }) => ({
      pathname: '/hospital-visit',
      params: patientParams(patient_id, patient_name),
    }),
  },
}

export interface DispatchResult {
  ok: boolean
  intent_id: IntentId
  reason?: string
}

/**
 * Resolve an intent and push the matching route.
 * Voice assistant: dispatchIntent(claudeOutput.intent_id, claudeOutput.params, router).
 */
export function dispatchIntent(
  intentId: IntentId,
  params: Record<string, string> | undefined,
  router: Router,
): DispatchResult {
  const def = INTENTS[intentId]
  if (!def) return { ok: false, intent_id: intentId, reason: 'unknown_intent' }

  const safeParams = params ?? {}
  for (const required of def.required_params ?? []) {
    if (!safeParams[required]) {
      return { ok: false, intent_id: intentId, reason: `missing_param:${required}` }
    }
  }

  const target = def.route(safeParams)
  // expo-router's typed pathname signature is strict — we cast because the
  // catalog is intentionally a runtime list, not statically tied to one route.
  router.push(target as Parameters<Router['push']>[0])
  return { ok: true, intent_id: intentId }
}

/**
 * Catalog shape passed to Claude as the tool list.
 * Each item describes one navigable destination + its required params.
 */
export function getIntentCatalog(): Array<
  Pick<IntentDef, 'id' | 'label_en' | 'label_th' | 'description' | 'required_params'>
> {
  return Object.values(INTENTS).map(
    ({ id, label_en, label_th, description, required_params }) => ({
      id,
      label_en,
      label_th,
      description,
      required_params,
    }),
  )
}
