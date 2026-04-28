// label-scanner — uses OpenAI GPT-4o vision to extract structured medication
// data from a Thai drug label image, then optionally stores the image in
// Supabase Storage.

import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  image_base64: string
  // patient_id is optional — used only to namespace the optional storage upload.
  patient_id?: string
}

// Mirror of `MedScanResult` in src/lib/openai.ts — keep these in sync.
type ScheduleType = 'meal_time' | 'interval_hours' | 'times_per_day' | 'as_needed' | ''

interface MedScanResult {
  name_th: string
  name_en: string
  strength: string
  unit: string
  dosage_form: string
  frequency: string
  schedule_type: ScheduleType
  frequency_hours: number
  times_per_day: number
  meal_relation: 'before' | 'after' | 'with' | 'any' | ''
  quantity: string
  hospital: string
  confidence: number
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a pharmacy assistant AI for Thai hospitals. Analyze the medication label photo and extract structured information.
Return ONLY a valid JSON object — no markdown, no explanation, just raw JSON — with exactly these fields:
{
  "name_th": "Thai medication name (empty string if not visible)",
  "name_en": "English/generic medication name",
  "strength": "numeric strength value only e.g. '500' or '10'",
  "unit": "unit of strength e.g. 'mg', 'ml', 'mcg', 'IU'",
  "dosage_form": "one of: tablet, capsule, liquid, injection, patch, inhaler, drops, cream, suppository, powder",
  "frequency": "dosing frequency exactly as written on the label",
  "schedule_type": "classify the frequency into one of: meal_time (linked to meals/food), interval_hours (every X hours), times_per_day (X times daily not linked to meals), as_needed (PRN/when needed) — empty string if unclear",
  "frequency_hours": "if schedule_type is interval_hours, the interval as integer e.g. 4, 6, 8, 12, 24 — otherwise 0",
  "times_per_day": "if schedule_type is times_per_day or meal_time, how many times per day as integer e.g. 1, 2, 3, 4 — otherwise 0",
  "meal_relation": "if schedule_type is meal_time: before, after, with, or any — otherwise empty string",
  "quantity": "total quantity in package e.g. '30', '100 ml'",
  "hospital": "issuing hospital or pharmacy name",
  "confidence": 0.0
}

Classification guide:
- 'every 4 hours' → schedule_type: interval_hours, frequency_hours: 4
- 'every 6 hours' → schedule_type: interval_hours, frequency_hours: 6
- 'twice daily' or '2 times a day' → schedule_type: times_per_day, times_per_day: 2
- '3 times daily' → schedule_type: times_per_day, times_per_day: 3
- 'after meals' or 'before food' or 'with breakfast' → schedule_type: meal_time
- 'as needed' or 'PRN' → schedule_type: as_needed
Set confidence to a number 0.0–1.0 reflecting how clearly the label was readable. If a field is not visible use an empty string.`

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  // Auth header is required (gateway is now deployed with --no-verify-jwt to
  // accept the new sb_publishable_* anon-key format), but our handler still
  // checks that *some* token was sent so direct unauth probes are rejected.
  const jwt = extractJWT(req)
  if (!jwt) return errorResponse('Unauthorized', 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const { image_base64, patient_id } = body
  if (!image_base64) return errorResponse('image_base64 is required')

  const serviceClient = createServiceClient()

  try {
    // ── 1. Call OpenAI GPT-4o Vision API ──────────────────────────────────
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured')

    // Determine media type — default to jpeg for drug label photos.
    // The base64 string may include a data URI prefix like "data:image/png;base64,"
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
      'image/jpeg'
    let rawBase64 = image_base64

    const dataUriMatch = image_base64.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (dataUriMatch) {
      const detectedType = dataUriMatch[1] as string
      if (
        detectedType === 'image/jpeg' ||
        detectedType === 'image/png' ||
        detectedType === 'image/webp' ||
        detectedType === 'image/gif'
      ) {
        mediaType = detectedType
      }
      rawBase64 = dataUriMatch[2]
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 700,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${rawBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    })

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text()
      throw new Error(`OpenAI ${openaiResponse.status}: ${errBody.slice(0, 300)}`)
    }

    // ── 2. Parse JSON from OpenAI's response ──────────────────────────────
    const completion = (await openaiResponse.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    const responseText = completion.choices?.[0]?.message?.content ?? ''

    let extracted: MedScanResult
    try {
      // Strip any markdown code fences if present
      const cleaned = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()
      extracted = JSON.parse(cleaned) as MedScanResult
    } catch {
      return errorResponse(
        `OpenAI returned non-JSON response: ${responseText.slice(0, 200)}`,
        422
      )
    }

    // ── 3. Set lowConfidence flag ─────────────────────────────────────────
    const LOW_CONFIDENCE_THRESHOLD = 0.85
    const lowConfidence =
      extracted.confidence === null ||
      extracted.confidence < LOW_CONFIDENCE_THRESHOLD

    // ── 4. Upload image to Supabase Storage (best-effort) ──────────────────
    // Bucket may not exist — failure here is non-fatal; we still return the
    // scan result. Caller may want to create the `label-scans` bucket later.
    const timestamp = Date.now()
    const namespace = patient_id ?? 'unattached'
    const storagePath = `${namespace}/${timestamp}.jpg`
    const BUCKET_NAME = 'label-scans'

    // Convert base64 to Uint8Array for storage upload
    const binaryString = atob(rawBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const { data: uploadData, error: uploadErr } = await serviceClient.storage
      .from(BUCKET_NAME)
      .upload(storagePath, bytes, {
        contentType: mediaType,
        upsert: false,
      })

    let imageUrl = ''
    if (uploadErr) {
      // Non-fatal: log the error but continue — we still return the extracted data
      console.error(`[label-scanner] Storage upload failed: ${uploadErr.message}`)
    } else {
      const { data: publicUrlData } = serviceClient.storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath)
      imageUrl = publicUrlData?.publicUrl ?? ''
    }

    // ── 5. Return result ───────────────────────────────────────────────────
    return jsonResponse({
      extracted,
      imageUrl,
      lowConfidence,
      storagePath: uploadErr ? null : storagePath,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[label-scanner]', message)
    return errorResponse(message, 500)
  }
})
