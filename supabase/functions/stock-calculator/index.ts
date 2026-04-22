// stock-calculator — calculates medication depletion dates, creates alerts,
// and triggers LINE notifications for contacts of affected patients.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createUserClient, createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  patient_id?: string
}

interface AlertSummary {
  inventoryId: string
  patientId: string
  medicationId: string
  medicationNameTh: string
  medicationNameEn: string
  daysRemaining: number
  level: 'critical' | 'warning'
  estimatedDepletionDate: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const jwt = extractJWT(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  let body: RequestBody = {}
  try {
    body = await req.json()
  } catch {
    // body is optional — default to {}
  }

  const userClient = createUserClient(jwt)
  const serviceClient = createServiceClient()

  try {
    // ── 1. Query inventory ────────────────────────────────────────────────
    let inventoryQuery = serviceClient
      .from('inventory')
      .select(
        'id, patient_id, medication_id, current_count, daily_rate, warning_threshold, critical_threshold, estimated_depletion_date'
      )

    if (body.patient_id) {
      inventoryQuery = inventoryQuery.eq('patient_id', body.patient_id)
    }

    const { data: inventoryRows, error: invErr } = await inventoryQuery

    if (invErr) throw new Error(`Inventory fetch failed: ${invErr.message}`)
    if (!inventoryRows || inventoryRows.length === 0) {
      return jsonResponse({ processed: 0, alerts: [] })
    }

    // ── 2. Fetch medications for display names ─────────────────────────────
    const medicationIds = [...new Set(inventoryRows.map((r: any) => r.medication_id))]
    const { data: medications, error: medErr } = await serviceClient
      .from('medications')
      .select('id, name_th, name_en')
      .in('id', medicationIds)

    if (medErr) throw new Error(`Medications fetch failed: ${medErr.message}`)
    const medMap: Record<string, any> = {}
    for (const m of medications ?? []) medMap[m.id] = m

    // ── 3. Fetch family contacts per patient for LINE notifications ─────────
    const patientIds = [...new Set(inventoryRows.map((r: any) => r.patient_id))]
    const { data: contacts, error: contactErr } = await serviceClient
      .from('family_contacts')
      .select('id, patient_id, line_user_id, quiet_hours_start, quiet_hours_end')
      .in('patient_id', patientIds)
      .not('line_user_id', 'is', null)

    if (contactErr) throw new Error(`Contacts fetch failed: ${contactErr.message}`)

    // Group contacts by patient_id
    const contactsByPatient: Record<string, any[]> = {}
    for (const c of contacts ?? []) {
      if (!contactsByPatient[c.patient_id]) contactsByPatient[c.patient_id] = []
      contactsByPatient[c.patient_id].push(c)
    }

    const today = new Date()
    const alerts: AlertSummary[] = []
    let processed = 0

    for (const row of inventoryRows) {
      processed++
      const med = medMap[row.medication_id] ?? {}

      // ── 4. Recalculate estimated depletion date ─────────────────────────
      const dailyRate = row.daily_rate > 0 ? row.daily_rate : 1
      const daysRemaining = Math.floor(row.current_count / dailyRate)
      const newDepletionDate = toISODate(addDays(today, daysRemaining))

      // ── 5. Update inventory with new depletion date ─────────────────────
      const { error: updateErr } = await serviceClient
        .from('inventory')
        .update({ estimated_depletion_date: newDepletionDate })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`[stock-calculator] Update failed for inventory ${row.id}: ${updateErr.message}`)
      }

      // ── 6. Determine alert level ────────────────────────────────────────
      let alertLevel: 'critical' | 'warning' | null = null
      let eventType: string | null = null

      if (daysRemaining <= row.critical_threshold) {
        alertLevel = 'critical'
        eventType = 'stock_critical'
      } else if (daysRemaining <= row.warning_threshold) {
        alertLevel = 'warning'
        eventType = 'stock_warning'
      }

      if (alertLevel && eventType) {
        // ── 7. Create notification_log entry ──────────────────────────────
        const { error: notifErr } = await serviceClient
          .from('notification_logs')
          .insert({
            patient_id: row.patient_id,
            event_type: eventType,
            channel: 'push',
            payload: {
              medication_id: row.medication_id,
              medication_name_th: med.name_th ?? '',
              medication_name_en: med.name_en ?? '',
              days_remaining: daysRemaining,
              estimated_depletion_date: newDepletionDate,
            },
            status: 'pending',
          })

        if (notifErr) {
          console.error(`[stock-calculator] Notification log failed: ${notifErr.message}`)
        }

        const summary: AlertSummary = {
          inventoryId: row.id,
          patientId: row.patient_id,
          medicationId: row.medication_id,
          medicationNameTh: med.name_th ?? '',
          medicationNameEn: med.name_en ?? '',
          daysRemaining,
          level: alertLevel,
          estimatedDepletionDate: newDepletionDate,
        }
        alerts.push(summary)

        // ── 8. Trigger line-notifier for family contacts ────────────────
        const patientContacts = contactsByPatient[row.patient_id] ?? []
        if (patientContacts.length > 0) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

          // Fire-and-forget (non-blocking) to avoid timeout
          fetch(`${supabaseUrl}/functions/v1/line-notifier`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              patient_id: row.patient_id,
              event_type: eventType,
              message_data: {
                medication_name_th: med.name_th ?? '',
                medication_name_en: med.name_en ?? '',
                days_remaining: daysRemaining,
                estimated_depletion_date: newDepletionDate,
              },
            }),
          }).catch((err) =>
            console.error(`[stock-calculator] line-notifier call failed: ${err.message}`)
          )
        }
      }
    }

    return jsonResponse({ processed, alerts })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[stock-calculator]', message)
    return errorResponse(message, 500)
  }
})
