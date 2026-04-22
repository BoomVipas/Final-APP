// medication-engine — returns full medication schedule for a patient on a given date
// grouped by time period with log status for each schedule item.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createUserClient, createServiceClient } from '../_shared/auth.ts'

// ─── Types ───────────────────────────────────────────────────────────────────

type TimePeriod = 'morning' | 'noon' | 'evening' | 'bedtime' | 'fixed'
type LogStatus = 'confirmed' | 'refused' | 'skipped' | 'pending'

interface ScheduleItem {
  scheduleId: string
  medicationId: string
  medicationNameTh: string
  medicationNameEn: string
  dosage: number
  unit: string
  form: string
  specialInstructions: string | null
  status: LogStatus
  logId?: string
  administeredAt?: string
  administeredBy?: string
  isDuplicateRisk: boolean
}

interface TimeGroup {
  period: TimePeriod
  scheduledTime: string
  items: ScheduleItem[]
}

interface RequestBody {
  patient_id: string
  date: string // YYYY-MM-DD
}

// ─── Period ordering ──────────────────────────────────────────────────────────

const PERIOD_ORDER: Record<TimePeriod, number> = {
  morning: 0,
  noon: 1,
  evening: 2,
  bedtime: 3,
  fixed: 4,
}

/**
 * Map a scheduled_time (HH:MM) or a period string from the DB to a TimePeriod.
 * The medication_schedules table has a `time_period` column (morning/noon/evening/bedtime)
 * or uses `scheduled_time` for fixed-time doses.
 */
function classifyPeriod(
  timePeriod: string | null,
  scheduledTime: string | null
): TimePeriod {
  if (timePeriod) {
    const lc = timePeriod.toLowerCase()
    if (lc === 'morning') return 'morning'
    if (lc === 'noon') return 'noon'
    if (lc === 'evening') return 'evening'
    if (lc === 'bedtime') return 'bedtime'
  }
  return 'fixed'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Auth
  const jwt = extractJWT(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const { patient_id, date } = body
  if (!patient_id) return errorResponse('patient_id is required')
  if (!date) return errorResponse('date is required')

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse('date must be in YYYY-MM-DD format')
  }

  const userClient = createUserClient(jwt)
  const serviceClient = createServiceClient()

  try {
    // ── 1. Fetch all active prescriptions for the patient ──────────────────
    const { data: prescriptions, error: prescErr } = await userClient
      .from('prescriptions')
      .select('id, medication_id, status, start_date, end_date')
      .eq('patient_id', patient_id)
      .eq('status', 'active')

    if (prescErr) throw new Error(`Prescriptions fetch failed: ${prescErr.message}`)
    if (!prescriptions || prescriptions.length === 0) {
      return jsonResponse({ schedule: [], date, patientId: patient_id })
    }

    const prescriptionIds = prescriptions.map((p: any) => p.id)
    const medicationIds = [...new Set(prescriptions.map((p: any) => p.medication_id))]

    // ── 2. Fetch medications for name/details ──────────────────────────────
    const { data: medications, error: medErr } = await userClient
      .from('medications')
      .select('id, name_th, name_en, form, unit')
      .in('id', medicationIds)

    if (medErr) throw new Error(`Medications fetch failed: ${medErr.message}`)

    const medMap: Record<string, any> = {}
    for (const m of medications ?? []) medMap[m.id] = m

    // ── 3. Fetch medication_schedules for all active prescriptions ─────────
    const { data: schedules, error: schedErr } = await userClient
      .from('medication_schedules')
      .select('id, prescription_id, dosage, unit, time_period, scheduled_time, special_instructions, is_active')
      .in('prescription_id', prescriptionIds)
      .eq('is_active', true)

    if (schedErr) throw new Error(`Schedules fetch failed: ${schedErr.message}`)
    if (!schedules || schedules.length === 0) {
      return jsonResponse({ schedule: [], date, patientId: patient_id })
    }

    // ── 4. Fetch medication_logs for this patient on this date ─────────────
    const dateStart = `${date}T00:00:00.000Z`
    const dateEnd = `${date}T23:59:59.999Z`

    const { data: logs, error: logErr } = await userClient
      .from('medication_logs')
      .select('id, schedule_id, status, administered_at, administered_by')
      .eq('patient_id', patient_id)
      .gte('administered_at', dateStart)
      .lte('administered_at', dateEnd)

    if (logErr) throw new Error(`Logs fetch failed: ${logErr.message}`)

    // Build log map keyed by schedule_id (last log wins if multiple)
    const logMap: Record<string, any> = {}
    for (const log of logs ?? []) {
      logMap[log.schedule_id] = log
    }

    // ── 5. Build schedule items with duplicate-dose check (inline) ─────────
    // check_duplicate_dose: a dose is a duplicate risk if another log entry
    // for the SAME medication already exists within a 60-minute window today.
    const medicationLogTimes: Record<string, string[]> = {}
    for (const log of logs ?? []) {
      const sched = schedules.find((s: any) => s.id === log.schedule_id)
      if (!sched) continue
      const presc = prescriptions.find((p: any) => p.id === sched.prescription_id)
      if (!presc) continue
      const medId = presc.medication_id
      if (!medicationLogTimes[medId]) medicationLogTimes[medId] = []
      medicationLogTimes[medId].push(log.administered_at)
    }

    function isDuplicateRisk(
      medicationId: string,
      scheduledTime: string | null
    ): boolean {
      const existing = medicationLogTimes[medicationId]
      if (!existing || existing.length === 0) return false
      if (!scheduledTime) return existing.length > 0
      const schedMs = new Date(`${date}T${scheduledTime}`).getTime()
      return existing.some((at) => {
        const logMs = new Date(at).getTime()
        return Math.abs(schedMs - logMs) <= 60 * 60 * 1000
      })
    }

    // ── 6. Group by time period ────────────────────────────────────────────
    const groupMap: Record<string, TimeGroup> = {}

    for (const sched of schedules) {
      const presc = prescriptions.find((p: any) => p.id === sched.prescription_id)
      if (!presc) continue

      const med = medMap[presc.medication_id]
      if (!med) continue

      const period = classifyPeriod(sched.time_period, sched.scheduled_time)
      const scheduledTime: string =
        sched.scheduled_time ??
        (period === 'morning'
          ? '08:00'
          : period === 'noon'
          ? '12:00'
          : period === 'evening'
          ? '18:00'
          : '21:00')

      const log = logMap[sched.id]
      const status: LogStatus = log ? log.status : 'pending'

      const item: ScheduleItem = {
        scheduleId: sched.id,
        medicationId: presc.medication_id,
        medicationNameTh: med.name_th ?? '',
        medicationNameEn: med.name_en ?? '',
        dosage: sched.dosage ?? 0,
        unit: sched.unit ?? med.unit ?? '',
        form: med.form ?? '',
        specialInstructions: sched.special_instructions ?? null,
        status,
        isDuplicateRisk: isDuplicateRisk(presc.medication_id, sched.scheduled_time),
        ...(log
          ? {
              logId: log.id,
              administeredAt: log.administered_at,
              administeredBy: log.administered_by,
            }
          : {}),
      }

      const groupKey = `${period}::${scheduledTime}`
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { period, scheduledTime, items: [] }
      }
      groupMap[groupKey].items.push(item)
    }

    // ── 7. Sort groups by period order then scheduled time ─────────────────
    const schedule: TimeGroup[] = Object.values(groupMap).sort((a, b) => {
      const periodDiff = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]
      if (periodDiff !== 0) return periodDiff
      return a.scheduledTime.localeCompare(b.scheduledTime)
    })

    return jsonResponse({ schedule, date, patientId: patient_id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[medication-engine]', message)
    return errorResponse(message, 500)
  }
})
