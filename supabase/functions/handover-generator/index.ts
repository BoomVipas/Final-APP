// handover-generator — generates shift handover summary JSON, saves to
// shift_handovers table, and returns the full summary.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createUserClient, createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  ward_id: string
  shift_start: string // ISO timestamp
}

interface PendingItem {
  patientName: string
  medicationName: string
  scheduledTime: string
  reason?: string
}

interface PrescriptionChange {
  patientName: string
  medicationName: string
  changeType: string
  previousValue: unknown
  newValue: unknown
  changedAt: string
  changedBy: string
}

interface HandoverAlert {
  type: 'stock_warning' | 'stock_critical' | 'duplicate_dose' | 'refusal'
  patientName: string
  detail: string
}

interface PrnMedication {
  patientName: string
  medicationName: string
  instructions: string
}

interface HandoverSummary {
  wardId: string
  shiftStart: string
  pendingItems: PendingItem[]
  prescriptionChanges: PrescriptionChange[]
  alerts: HandoverAlert[]
  prnMedications: PrnMedication[]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const jwt = extractJWT(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const { ward_id, shift_start } = body
  if (!ward_id) return errorResponse('ward_id is required')
  if (!shift_start) return errorResponse('shift_start is required')

  const userClient = createUserClient(jwt)
  const serviceClient = createServiceClient()

  try {
    // ── 1. Call generate_handover_summary DB function ──────────────────────
    const { data: dbSummaryData, error: dbFnErr } = await serviceClient.rpc(
      'generate_handover_summary',
      { ward_id, shift_start }
    )

    if (dbFnErr) {
      // If the DB function doesn't exist yet, we fall back to building the
      // summary manually from raw queries so the function still works.
      console.warn(
        `[handover-generator] generate_handover_summary RPC failed (${dbFnErr.message}), building summary from raw queries`
      )
    }

    // ── 2. Fetch caregivers in this ward ──────────────────────────────────
    const { data: caregivers, error: cgErr } = await serviceClient
      .from('caregivers')
      .select('id, name, role')
      .eq('ward_id', ward_id)
      .eq('is_active', true)

    if (cgErr) throw new Error(`Caregivers fetch failed: ${cgErr.message}`)

    // ── 3. Build summary from DB function result or raw queries ───────────
    let summary: HandoverSummary

    if (dbSummaryData && !dbFnErr) {
      // DB function returned a usable result — normalise it
      const raw = typeof dbSummaryData === 'string'
        ? JSON.parse(dbSummaryData)
        : dbSummaryData

      summary = {
        wardId: ward_id,
        shiftStart: shift_start,
        pendingItems: raw.pending_items ?? raw.pendingItems ?? [],
        prescriptionChanges: raw.prescription_changes ?? raw.prescriptionChanges ?? [],
        alerts: raw.alerts ?? [],
        prnMedications: raw.prn_medications ?? raw.prnMedications ?? [],
      }
    } else {
      // ── Fallback: build summary from raw queries ───────────────────────
      summary = await buildSummaryFromRawQueries(
        serviceClient,
        ward_id,
        shift_start
      )
    }

    // ── 4. Insert into shift_handovers for each caregiver in the ward ─────
    const primaryCaregiver = caregivers && caregivers.length > 0 ? caregivers[0] : null

    const { data: handoverRecord, error: insertErr } = await serviceClient
      .from('shift_handovers')
      .insert({
        ward_id,
        shift_start,
        summary_json: summary,
        caregiver_id: primaryCaregiver?.id ?? null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertErr) {
      // Non-fatal — still return the summary even if the insert fails
      console.error(`[handover-generator] Insert failed: ${insertErr.message}`)
    }

    return jsonResponse({
      handover: handoverRecord ?? { ward_id, shift_start, summary_json: summary },
      summary,
      caregivers: caregivers ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[handover-generator]', message)
    return errorResponse(message, 500)
  }
})

// ─── Fallback: build summary from raw queries ─────────────────────────────────

async function buildSummaryFromRawQueries(
  serviceClient: ReturnType<typeof createClient>,
  wardId: string,
  shiftStart: string
): Promise<HandoverSummary> {
  const shiftDate = shiftStart.split('T')[0]
  const shiftStartMs = new Date(shiftStart).getTime()
  // Assume 8-hour shift window
  const shiftEndMs = shiftStartMs + 8 * 60 * 60 * 1000
  const shiftEnd = new Date(shiftEndMs).toISOString()

  // ── Fetch patients in this ward ─────────────────────────────────────────
  const { data: patients, error: pErr } = await serviceClient
    .from('patients')
    .select('id, name_th, name_en')
    .eq('ward_id', wardId)
    .eq('is_active', true)

  if (pErr) throw new Error(`Patients fetch failed: ${pErr.message}`)
  if (!patients || patients.length === 0) {
    return {
      wardId,
      shiftStart,
      pendingItems: [],
      prescriptionChanges: [],
      alerts: [],
      prnMedications: [],
    }
  }

  const patientIds = patients.map((p: any) => p.id)
  const patientMap: Record<string, string> = {}
  for (const p of patients) patientMap[p.id] = p.name_th ?? p.name_en ?? p.id

  // ── Pending medications (scheduled but not logged in this shift) ────────
  const { data: schedules } = await serviceClient
    .from('medication_schedules')
    .select(
      'id, prescription_id, scheduled_time, time_period, special_instructions, prescriptions(patient_id, medication_id, medications(name_th, name_en))'
    )
    .eq('is_active', true)

  const { data: logsInShift } = await serviceClient
    .from('medication_logs')
    .select('schedule_id, status, administered_at')
    .in('patient_id', patientIds)
    .gte('administered_at', shiftStart)
    .lte('administered_at', shiftEnd)

  const loggedScheduleIds = new Set((logsInShift ?? []).map((l: any) => l.schedule_id))
  const refusedLogs = (logsInShift ?? []).filter((l: any) => l.status === 'refused')

  const pendingItems: PendingItem[] = []
  for (const sched of schedules ?? []) {
    const presc = (sched as any).prescriptions
    if (!presc) continue
    if (!patientIds.includes(presc.patient_id)) continue
    if (loggedScheduleIds.has(sched.id)) continue

    const med = presc.medications
    pendingItems.push({
      patientName: patientMap[presc.patient_id] ?? presc.patient_id,
      medicationName: med
        ? `${med.name_th ?? ''} / ${med.name_en ?? ''}`.trim()
        : sched.prescription_id,
      scheduledTime:
        sched.scheduled_time ??
        (sched.time_period === 'morning'
          ? '08:00'
          : sched.time_period === 'noon'
          ? '12:00'
          : sched.time_period === 'evening'
          ? '18:00'
          : '21:00'),
    })
  }

  // ── Prescription changes during this shift ──────────────────────────────
  const { data: changes } = await serviceClient
    .from('prescription_changes')
    .select(
      'id, prescription_id, change_type, previous_value, new_value, changed_at, changed_by, prescriptions(patient_id, medication_id, medications(name_th, name_en))'
    )
    .in('prescription_id',
      (schedules ?? []).map((s: any) => s.prescription_id).filter(Boolean)
    )
    .gte('changed_at', shiftStart)
    .lte('changed_at', shiftEnd)

  const prescriptionChanges: PrescriptionChange[] = (changes ?? []).map((c: any) => {
    const presc = c.prescriptions
    const med = presc?.medications
    return {
      patientName: patientMap[presc?.patient_id] ?? '',
      medicationName: med ? `${med.name_th ?? ''} / ${med.name_en ?? ''}`.trim() : '',
      changeType: c.change_type ?? '',
      previousValue: c.previous_value,
      newValue: c.new_value,
      changedAt: c.changed_at,
      changedBy: c.changed_by ?? '',
    }
  })

  // ── Alerts: stock, refusals ────────────────────────────────────────────
  const { data: stockAlerts } = await serviceClient
    .from('notification_logs')
    .select('patient_id, event_type, payload, created_at')
    .in('patient_id', patientIds)
    .in('event_type', ['stock_warning', 'stock_critical'])
    .gte('created_at', shiftStart)
    .lte('created_at', shiftEnd)

  const alerts: HandoverAlert[] = []

  for (const sa of stockAlerts ?? []) {
    const payload = sa.payload ?? {}
    alerts.push({
      type: sa.event_type as 'stock_warning' | 'stock_critical',
      patientName: patientMap[sa.patient_id] ?? sa.patient_id,
      detail: `${payload.medication_name_th ?? ''} — ${payload.days_remaining ?? '?'} วันคงเหลือ`,
    })
  }

  for (const refLog of refusedLogs) {
    const refSched = (schedules ?? []).find((s: any) => s.id === refLog.schedule_id)
    if (!refSched) continue
    const presc = (refSched as any).prescriptions
    if (!presc) continue
    const med = presc.medications
    alerts.push({
      type: 'refusal',
      patientName: patientMap[presc.patient_id] ?? presc.patient_id,
      detail: `ปฏิเสธรับยา: ${med ? `${med.name_th ?? ''} / ${med.name_en ?? ''}`.trim() : ''} เวลา ${refLog.administered_at}`,
    })
  }

  // ── PRN medications ────────────────────────────────────────────────────
  const { data: prnSchedules } = await serviceClient
    .from('medication_schedules')
    .select(
      'id, special_instructions, prescriptions(patient_id, medication_id, medications(name_th, name_en))'
    )
    .eq('is_active', true)
    .ilike('time_period', '%prn%')

  const prnMedications: PrnMedication[] = []
  for (const p of prnSchedules ?? []) {
    const presc = (p as any).prescriptions
    if (!presc || !patientIds.includes(presc.patient_id)) continue
    const med = presc.medications
    prnMedications.push({
      patientName: patientMap[presc.patient_id] ?? presc.patient_id,
      medicationName: med
        ? `${med.name_th ?? ''} / ${med.name_en ?? ''}`.trim()
        : '',
      instructions: p.special_instructions ?? 'ตามความจำเป็น',
    })
  }

  return {
    wardId,
    shiftStart,
    pendingItems,
    prescriptionChanges,
    alerts,
    prnMedications,
  }
}
