/**
 * src/lib/openai.ts
 * OpenAI GPT-4o vision helper for medication label scanning.
 */

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
  frequency_hours: number     // used when schedule_type = 'interval_hours' e.g. 4, 6, 8, 12, 24
  times_per_day: number       // used when schedule_type = 'times_per_day' e.g. 1, 2, 3, 4
  meal_relation: 'before' | 'after' | 'with' | 'any' | ''  // used when schedule_type = 'meal_time'
  quantity: string
  hospital: string
  confidence: number
}

const SYSTEM_PROMPT = `You are a pharmacy assistant AI for Thai hospitals. Analyze the medication label photo and extract structured information.
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

export async function analyzeMedicationLabel(base64Image: string): Promise<MedScanResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured (EXPO_PUBLIC_OPENAI_API_KEY)')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
            { type: 'text', text: SYSTEM_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 200)}`)
  }

  const json = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }

  const raw = json.choices?.[0]?.message?.content ?? ''
  const jsonText = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()

  try {
    return JSON.parse(jsonText) as MedScanResult
  } catch {
    throw new Error(`Could not parse AI response: ${raw.slice(0, 200)}`)
  }
}
