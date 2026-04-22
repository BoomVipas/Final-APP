// line-notifier — sends LINE Flex Messages to family contacts for a patient.
// Respects quiet hours for non-critical events.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | 'stock_warning'
  | 'stock_critical'
  | 'prescription_changed'
  | 'appointment_reminder'
  | 'weekly_summary'

interface RequestBody {
  patient_id: string
  event_type: EventType
  message_data: Record<string, unknown>
}

interface FamilyContact {
  id: string
  patient_id: string
  line_user_id: string | null
  name: string | null
  quiet_hours_start: string | null // "HH:MM"
  quiet_hours_end: string | null   // "HH:MM"
}

interface SendResult {
  sent: number
  failed: number
  skipped: number
}

// ─── Quiet-hours check ────────────────────────────────────────────────────────

/**
 * Returns true if the current UTC time (converted to Asia/Bangkok UTC+7)
 * falls within the contact's quiet hours.
 */
function isQuietHour(contact: FamilyContact): boolean {
  if (!contact.quiet_hours_start || !contact.quiet_hours_end) return false

  // Bangkok is UTC+7
  const nowUtc = new Date()
  const bangkokOffset = 7 * 60 // minutes
  const bangkokMs = nowUtc.getTime() + bangkokOffset * 60 * 1000
  const bangkokDate = new Date(bangkokMs)

  const currentHH = bangkokDate.getUTCHours()
  const currentMM = bangkokDate.getUTCMinutes()
  const currentMinutes = currentHH * 60 + currentMM

  const [startH, startM] = contact.quiet_hours_start.split(':').map(Number)
  const [endH, endM] = contact.quiet_hours_end.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    // Normal range e.g. 22:00 – 06:00 crosses midnight handled below
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    // Range crosses midnight e.g. 22:00 – 06:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

// ─── LINE Flex Message builders ───────────────────────────────────────────────

function buildFlexMessage(
  eventType: EventType,
  data: Record<string, unknown>
): object {
  switch (eventType) {
    case 'stock_warning':
    case 'stock_critical': {
      const isCritical = eventType === 'stock_critical'
      const medNameTh = String(data.medication_name_th ?? '')
      const medNameEn = String(data.medication_name_en ?? '')
      const daysRemaining = Number(data.days_remaining ?? 0)
      const depletionDate = String(data.estimated_depletion_date ?? '')

      return {
        type: 'flex',
        altText: isCritical
          ? `⚠️ ยาหมดเร็วๆ นี้: ${medNameTh}`
          : `แจ้งเตือนยาใกล้หมด: ${medNameTh}`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: isCritical ? '⚠️ ยาเหลือน้อยมาก' : '📦 ยาใกล้หมด',
                weight: 'bold',
                color: isCritical ? '#CC0000' : '#FF8800',
                size: 'lg',
              },
            ],
            backgroundColor: isCritical ? '#FFE5E5' : '#FFF3E0',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${medNameTh} / ${medNameEn}`,
                weight: 'bold',
                size: 'md',
                wrap: true,
              },
              {
                type: 'text',
                text: `คงเหลือ: ${daysRemaining} วัน`,
                color: isCritical ? '#CC0000' : '#FF8800',
                size: 'sm',
                margin: 'sm',
              },
              {
                type: 'text',
                text: `ยาจะหมดประมาณ: ${depletionDate}`,
                color: '#666666',
                size: 'sm',
                margin: 'sm',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                text: 'กรุณาติดต่อสถานพยาบาลเพื่อรับยาเพิ่ม',
                size: 'sm',
                wrap: true,
                margin: 'md',
                color: '#444444',
              },
            ],
          },
        },
      }
    }

    case 'prescription_changed': {
      const patientName = String(data.patient_name ?? '')
      const medName = String(data.medication_name ?? '')
      const changeType = String(data.change_type ?? 'เปลี่ยนแปลง')
      const oldVal = JSON.stringify(data.previous_value ?? '-')
      const newVal = JSON.stringify(data.new_value ?? '-')
      const changedAt = String(data.changed_at ?? '')

      return {
        type: 'flex',
        altText: `การเปลี่ยนแปลงใบสั่งยา: ${patientName}`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📋 ใบสั่งยามีการเปลี่ยนแปลง',
                weight: 'bold',
                color: '#1A73E8',
                size: 'lg',
              },
            ],
            backgroundColor: '#E8F0FE',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `ผู้ป่วย: ${patientName}`,
                weight: 'bold',
                size: 'md',
              },
              {
                type: 'text',
                text: `ยา: ${medName}`,
                size: 'sm',
                margin: 'sm',
                wrap: true,
              },
              {
                type: 'text',
                text: `การเปลี่ยนแปลง: ${changeType}`,
                size: 'sm',
                margin: 'sm',
                color: '#1A73E8',
              },
              {
                type: 'text',
                text: `ก่อนหน้า: ${oldVal}`,
                size: 'xs',
                color: '#888888',
                margin: 'sm',
                wrap: true,
              },
              {
                type: 'text',
                text: `ใหม่: ${newVal}`,
                size: 'xs',
                color: '#2E7D32',
                margin: 'xs',
                wrap: true,
              },
              {
                type: 'text',
                text: `เมื่อ: ${changedAt}`,
                size: 'xs',
                color: '#999999',
                margin: 'sm',
              },
            ],
          },
        },
      }
    }

    case 'appointment_reminder': {
      const apptDate = String(data.appointment_date ?? '')
      const hospital = String(data.hospital ?? '')
      const medicationSummary = String(data.medication_summary ?? '')

      return {
        type: 'flex',
        altText: `แจ้งเตือนนัดหมาย: ${hospital}`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '🏥 แจ้งเตือนนัดหมายแพทย์',
                weight: 'bold',
                color: '#1B5E20',
                size: 'lg',
              },
            ],
            backgroundColor: '#E8F5E9',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `วันที่นัด: ${apptDate}`,
                weight: 'bold',
                size: 'md',
              },
              {
                type: 'text',
                text: `สถานพยาบาล: ${hospital}`,
                size: 'sm',
                margin: 'sm',
                wrap: true,
              },
              ...(medicationSummary
                ? [
                    {
                      type: 'separator' as const,
                      margin: 'md' as const,
                    },
                    {
                      type: 'text' as const,
                      text: 'รายการยาปัจจุบัน:',
                      size: 'sm' as const,
                      weight: 'bold' as const,
                      margin: 'md' as const,
                    },
                    {
                      type: 'text' as const,
                      text: medicationSummary,
                      size: 'xs' as const,
                      color: '#555555' as const,
                      wrap: true,
                      margin: 'sm' as const,
                    },
                  ]
                : []),
            ],
          },
        },
      }
    }

    case 'weekly_summary': {
      const adherenceRate = Number(data.adherence_rate ?? 0)
      const patientName = String(data.patient_name ?? '')
      const weekStart = String(data.week_start ?? '')
      const weekEnd = String(data.week_end ?? '')
      const adherencePct = Math.round(adherenceRate * 100)
      const adherenceColor =
        adherencePct >= 90 ? '#2E7D32' : adherencePct >= 70 ? '#F57C00' : '#C62828'

      return {
        type: 'flex',
        altText: `สรุปประจำสัปดาห์: ${patientName}`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📊 สรุปการรับยาประจำสัปดาห์',
                weight: 'bold',
                color: '#4A148C',
                size: 'lg',
              },
            ],
            backgroundColor: '#F3E5F5',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `ผู้ป่วย: ${patientName}`,
                weight: 'bold',
                size: 'md',
              },
              {
                type: 'text',
                text: `ช่วงเวลา: ${weekStart} – ${weekEnd}`,
                size: 'sm',
                color: '#666666',
                margin: 'sm',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'text',
                text: 'อัตราการรับยา',
                size: 'sm',
                weight: 'bold',
                margin: 'md',
              },
              {
                type: 'text',
                text: `${adherencePct}%`,
                size: 'xxl',
                weight: 'bold',
                color: adherenceColor,
                margin: 'sm',
              },
              {
                type: 'text',
                text:
                  adherencePct >= 90
                    ? '✅ ยอดเยี่ยม'
                    : adherencePct >= 70
                    ? '⚠️ ควรติดตาม'
                    : '❌ ต้องการความช่วยเหลือ',
                size: 'sm',
                color: adherenceColor,
              },
            ],
          },
        },
      }
    }

    default: {
      return {
        type: 'text',
        text: JSON.stringify(data),
      }
    }
  }
}

// ─── LINE API call ────────────────────────────────────────────────────────────

async function sendLineMessage(
  lineUserId: string,
  message: object,
  channelToken: string
): Promise<boolean> {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [message],
    }),
  })
  return response.ok
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  // Auth — allow service-role calls (from stock-calculator) as well as user JWTs
  const jwt = extractJWT(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const { patient_id, event_type, message_data } = body
  if (!patient_id) return errorResponse('patient_id is required')
  if (!event_type) return errorResponse('event_type is required')
  if (!message_data) return errorResponse('message_data is required')

  const validEventTypes: EventType[] = [
    'stock_warning',
    'stock_critical',
    'prescription_changed',
    'appointment_reminder',
    'weekly_summary',
  ]
  if (!validEventTypes.includes(event_type)) {
    return errorResponse(`Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`)
  }

  const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
  if (!lineToken) return errorResponse('LINE_CHANNEL_ACCESS_TOKEN is not configured', 500)

  const serviceClient = createServiceClient()

  try {
    // ── 1. Fetch family contacts with LINE configured ─────────────────────
    const { data: contacts, error: contactErr } = await serviceClient
      .from('family_contacts')
      .select('id, patient_id, line_user_id, name, quiet_hours_start, quiet_hours_end')
      .eq('patient_id', patient_id)
      .not('line_user_id', 'is', null)

    if (contactErr) throw new Error(`Contacts fetch failed: ${contactErr.message}`)
    if (!contacts || contacts.length === 0) {
      return jsonResponse({ sent: 0, failed: 0, skipped: 0 })
    }

    // ── 2. Build the Flex Message ─────────────────────────────────────────
    const flexMessage = buildFlexMessage(event_type, message_data)

    // ── 3. Send to each contact (respecting quiet hours) ──────────────────
    const isCritical =
      event_type === 'stock_critical'

    const result: SendResult = { sent: 0, failed: 0, skipped: 0 }
    const notifInserts: object[] = []

    for (const contact of contacts as FamilyContact[]) {
      if (!contact.line_user_id) continue

      // Skip quiet hours for non-critical events
      if (!isCritical && isQuietHour(contact)) {
        result.skipped++
        notifInserts.push({
          patient_id,
          event_type,
          channel: 'line',
          recipient_id: contact.id,
          status: 'skipped',
          payload: message_data,
          note: 'quiet_hours',
        })
        continue
      }

      const success = await sendLineMessage(
        contact.line_user_id,
        flexMessage,
        lineToken
      )

      if (success) {
        result.sent++
        notifInserts.push({
          patient_id,
          event_type,
          channel: 'line',
          recipient_id: contact.id,
          status: 'sent',
          payload: message_data,
        })
      } else {
        result.failed++
        notifInserts.push({
          patient_id,
          event_type,
          channel: 'line',
          recipient_id: contact.id,
          status: 'failed',
          payload: message_data,
        })
      }
    }

    // ── 4. Log results to notification_logs ───────────────────────────────
    if (notifInserts.length > 0) {
      const { error: logErr } = await serviceClient
        .from('notification_logs')
        .insert(notifInserts)

      if (logErr) {
        console.error(`[line-notifier] Notification log insert failed: ${logErr.message}`)
      }
    }

    return jsonResponse(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[line-notifier]', message)
    return errorResponse(message, 500)
  }
})
