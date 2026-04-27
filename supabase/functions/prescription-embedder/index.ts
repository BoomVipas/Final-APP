// prescription-embedder — embeds patient_prescriptions rows into pgvector for
// the voice-assistant RAG pipeline (PDF §10.3.3).
//
// Two operating modes:
//   1. Webhook mode (default): receives Supabase Database Webhook payloads on
//      patient_prescriptions INSERT / UPDATE / DELETE. Soft-deletes any
//      previous embeddings for that prescription, then inserts a fresh
//      embedding from a freshly-built chunk text.
//   2. Backfill mode: POST { "backfill": true } embeds every active
//      prescription. Use once after deploy to seed `prescription_embeddings`,
//      then again any time the embedding format changes.
//
// Required Supabase secrets:
//   OPENAI_API_KEY (text-embedding-3-small)
//
// Deploy with `--no-verify-jwt` so Supabase webhooks (which don't carry a
// user JWT) can reach it:
//   supabase functions deploy prescription-embedder --no-verify-jwt

import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientPrescription {
  id: string
  patient_id: string
  medicine_id: string
  dose_quantity: number | null
  meal_times: string[] | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  notes: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: PatientPrescription | null
  old_record: PatientPrescription | null
}

interface BackfillRequest {
  backfill: true
}

type RequestBody = WebhookPayload | BackfillRequest

// ─── Embedding helpers ───────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMS = 1536

async function embedText(text: string, openaiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`OpenAI embeddings ${res.status}: ${errBody.slice(0, 300)}`)
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
  const vector = json.data?.[0]?.embedding
  if (!vector || vector.length !== EMBEDDING_DIMS) {
    throw new Error(`Unexpected embedding size: ${vector?.length}`)
  }
  return vector
}

// Composes a Thai-first natural-language description of a prescription that
// captures everything the voice assistant might be asked. Joining medicine +
// patient context lets queries like "what is Khun Malee taking for diabetes?"
// cosine-match this row even though it lives in three tables.
function buildChunkText(args: {
  rx: PatientPrescription
  medicine: { name: string; category: string | null; dosage_form: string | null; strength: string | null }
  patient: { name: string }
}): string {
  const { rx, medicine, patient } = args
  const lines: string[] = [
    `ผู้ป่วย / Patient: ${patient.name}`,
    `ยา / Medication: ${medicine.name}`,
  ]
  if (medicine.strength) lines.push(`ขนาด / Strength: ${medicine.strength}`)
  if (medicine.dosage_form) lines.push(`รูปแบบ / Form: ${medicine.dosage_form}`)
  if (medicine.category) lines.push(`หมวด / Category: ${medicine.category}`)
  if (rx.dose_quantity != null) {
    lines.push(`จำนวนต่อครั้ง / Dose: ${rx.dose_quantity}`)
  }
  if (rx.meal_times && rx.meal_times.length > 0) {
    lines.push(`มื้อ / Meal times: ${rx.meal_times.join(', ')}`)
  }
  if (rx.start_date) lines.push(`เริ่ม / Start: ${rx.start_date}`)
  if (rx.end_date) lines.push(`สิ้นสุด / End: ${rx.end_date}`)
  if (rx.notes) lines.push(`หมายเหตุ / Notes: ${rx.notes}`)
  return lines.join('\n')
}

// ─── Core operations ─────────────────────────────────────────────────────────

async function softDeleteEmbeddings(
  prescriptionId: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { error } = await supabase
    .from('prescription_embeddings')
    .update({ is_active: false })
    .eq('prescription_id', prescriptionId)
    .eq('is_active', true)
  if (error) throw new Error(`Soft-delete failed: ${error.message}`)
}

async function embedPrescription(
  rx: PatientPrescription,
  supabase: ReturnType<typeof createServiceClient>,
  openaiKey: string,
): Promise<{ chunkLength: number }> {
  // Fetch the join targets so the chunk can describe the prescription in
  // human terms (drug name / patient name) instead of just ids.
  const [medRes, patientRes] = await Promise.all([
    supabase
      .from('medicines')
      .select('id, name, category, dosage_form, strength')
      .eq('id', rx.medicine_id)
      .maybeSingle(),
    supabase
      .from('patients')
      .select('id, name')
      .eq('id', rx.patient_id)
      .maybeSingle(),
  ])

  if (medRes.error) throw new Error(`medicines lookup: ${medRes.error.message}`)
  if (patientRes.error) throw new Error(`patients lookup: ${patientRes.error.message}`)
  if (!medRes.data) throw new Error(`medicine ${rx.medicine_id} not found`)
  if (!patientRes.data) throw new Error(`patient ${rx.patient_id} not found`)

  const chunkText = buildChunkText({
    rx,
    medicine: medRes.data,
    patient: { name: patientRes.data.name },
  })

  const vector = await embedText(chunkText, openaiKey)

  // Soft-delete first, then insert. PDF §10.3.3 says there should never be a
  // gap window without an active embedding — but our row is per-prescription,
  // and INSERT before UPDATE-soft-delete would briefly have two active rows.
  // Do it the other way: soft-delete the old, immediately insert the new.
  // For sub-second OpenAI latency this is the simplest correct ordering.
  await softDeleteEmbeddings(rx.id, supabase)

  const { error: insertErr } = await supabase
    .from('prescription_embeddings')
    .insert({
      prescription_id: rx.id,
      patient_id: rx.patient_id,
      chunk_text: chunkText,
      embedding: vector,
      metadata: {
        medicine_id: rx.medicine_id,
        medicine_name: medRes.data.name,
        meal_times: rx.meal_times ?? [],
        dose_quantity: rx.dose_quantity,
        is_active: rx.is_active,
      },
      is_active: true,
    })

  if (insertErr) throw new Error(`embedding insert: ${insertErr.message}`)

  return { chunkLength: chunkText.length }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return errorResponse('OPENAI_API_KEY not configured', 500)

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const supabase = createServiceClient()

  // ── Backfill mode ───────────────────────────────────────────────────────
  if ('backfill' in body && body.backfill === true) {
    const { data: rxs, error } = await supabase
      .from('patient_prescriptions')
      .select('id, patient_id, medicine_id, dose_quantity, meal_times, start_date, end_date, is_active, notes')
      .eq('is_active', true)

    if (error) return errorResponse(`Backfill query failed: ${error.message}`, 500)

    const results = { embedded: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> }
    for (const rx of (rxs ?? []) as PatientPrescription[]) {
      try {
        await embedPrescription(rx, supabase, openaiKey)
        results.embedded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[prescription-embedder backfill] ${rx.id} failed:`, msg)
        results.failed++
        results.errors.push({ id: rx.id, error: msg })
      }
    }
    return jsonResponse(results)
  }

  // ── Webhook mode ────────────────────────────────────────────────────────
  const payload = body as WebhookPayload
  if (payload.table !== 'patient_prescriptions') {
    return jsonResponse({ skipped: 'wrong table', table: payload.table })
  }

  try {
    if (payload.type === 'DELETE') {
      const oldId = payload.old_record?.id
      if (!oldId) return jsonResponse({ skipped: 'DELETE without old_record.id' })
      await softDeleteEmbeddings(oldId, supabase)
      return jsonResponse({ ok: true, action: 'soft-delete', prescription_id: oldId })
    }

    const rx = payload.record
    if (!rx?.id) return jsonResponse({ skipped: 'missing record.id' })

    // is_active flipped to false → treat as a delete (no active embedding).
    if (rx.is_active === false) {
      await softDeleteEmbeddings(rx.id, supabase)
      return jsonResponse({ ok: true, action: 'soft-delete (inactive)', prescription_id: rx.id })
    }

    const result = await embedPrescription(rx, supabase, openaiKey)
    return jsonResponse({
      ok: true,
      action: 'embedded',
      prescription_id: rx.id,
      chunk_length: result.chunkLength,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[prescription-embedder]', msg)
    // Return 200 so Supabase webhooks don't retry on permanent errors
    // (e.g. bad row, OpenAI rate-limit). Errors are visible in the logs.
    return jsonResponse({ ok: false, error: msg }, 200)
  }
})
