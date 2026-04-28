/**
 * src/lib/openai.ts
 *
 * Drug-label scanning helper. Despite the historical filename, this no longer
 * calls OpenAI directly from the client — that path leaked the API key into
 * the bundled JS. Instead it invokes the `label-scanner` Supabase Edge
 * Function, which holds the AI vendor key as a server-side secret and
 * returns the same `MedScanResult` shape.
 *
 * Keeping the filename + exported symbol so existing callers (e.g.
 * `app/scanner.tsx`) work unchanged.
 */

import { supabase } from './supabase'

export type ScheduleType = 'meal_time' | 'interval_hours' | 'times_per_day' | 'as_needed'

export interface MedScanResult {
  name_th: string
  name_en: string
  strength: string
  unit: string
  dosage_form: string
  // Raw frequency text as printed on the label
  frequency: string
  // Parsed schedule fields — AI classifies the frequency text
  schedule_type: ScheduleType | ''
  frequency_hours: number
  times_per_day: number
  meal_relation: 'before' | 'after' | 'with' | 'any' | ''
  quantity: string
  hospital: string
  confidence: number
}

interface LabelScannerResponse {
  extracted: MedScanResult
  imageUrl: string
  lowConfidence: boolean
  storagePath: string | null
}

/**
 * Send a base64-encoded label photo to the `label-scanner` edge function and
 * return the parsed medication info. The edge function uses Claude vision and
 * holds the ANTHROPIC_API_KEY as a Supabase secret.
 */
export async function analyzeMedicationLabel(
  base64Image: string,
  patientId?: string,
): Promise<MedScanResult> {
  const { data, error } = await supabase.functions.invoke<LabelScannerResponse>(
    'label-scanner',
    { body: { image_base64: base64Image, patient_id: patientId } },
  )
  if (error) throw new Error(error.message)
  if (!data?.extracted) throw new Error('label-scanner returned no extraction')
  return data.extracted
}
