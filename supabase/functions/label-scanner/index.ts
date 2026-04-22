// label-scanner — uses Claude Vision API to extract structured medication data
// from a Thai drug label image, then stores the image in Supabase Storage.

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@latest'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { extractJWT, createUserClient, createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  image_base64: string
  patient_id: string
}

interface PrescriptionDraft {
  name_th: string | null
  name_en: string | null
  dosage: number | null
  unit: string | null
  form: 'tablet' | 'liquid' | 'patch' | 'injection' | null
  frequency: string | null
  quantity_dispensed: number | null
  prescribing_hospital: string | null
  special_instructions: string | null
  confidence: number | null
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Extract medication information from this Thai drug label. Return a JSON object with these fields:
- name_th: Thai drug name (string)
- name_en: English drug name (string)
- dosage: numeric dosage amount (number)
- unit: dosage unit e.g. mg, ml (string)
- form: tablet|liquid|patch|injection (string)
- frequency: dosing frequency description (string)
- quantity_dispensed: total quantity in package (number)
- prescribing_hospital: hospital name if visible (string)
- special_instructions: any special instructions (string)
- confidence: overall extraction confidence 0-1 (number)

If any field cannot be determined, set it to null.
Return only valid JSON, no explanation.`

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

  const { image_base64, patient_id } = body
  if (!image_base64) return errorResponse('image_base64 is required')
  if (!patient_id) return errorResponse('patient_id is required')

  const serviceClient = createServiceClient()

  try {
    // ── 1. Call Anthropic Claude Vision API ───────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured')

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Determine media type — default to jpeg for drug label photos
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

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: rawBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    })

    // ── 2. Parse JSON from Claude's response ──────────────────────────────
    const responseText =
      claudeResponse.content[0].type === 'text'
        ? claudeResponse.content[0].text
        : ''

    let extracted: PrescriptionDraft
    try {
      // Strip any markdown code fences if present
      const cleaned = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()
      extracted = JSON.parse(cleaned) as PrescriptionDraft
    } catch {
      // If Claude returned something un-parseable, return it as an error
      return errorResponse(
        `Claude returned non-JSON response: ${responseText.slice(0, 200)}`,
        422
      )
    }

    // ── 3. Set lowConfidence flag ─────────────────────────────────────────
    const LOW_CONFIDENCE_THRESHOLD = 0.85
    const lowConfidence =
      extracted.confidence === null ||
      extracted.confidence < LOW_CONFIDENCE_THRESHOLD

    // ── 4. Upload image to Supabase Storage ────────────────────────────────
    const timestamp = Date.now()
    const storagePath = `${patient_id}/${timestamp}.jpg`
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
