/**
 * src/lib/openai.ts
 * OpenAI GPT-4o vision helper for medication label scanning.
 */

export interface MedScanResult {
  name_th: string
  name_en: string
  strength: string
  unit: string
  dosage_form: string
  frequency: string
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
  "frequency": "dosing frequency as written on the label e.g. '3 times daily', 'twice daily'",
  "quantity": "total quantity in package e.g. '30', '100 ml'",
  "hospital": "issuing hospital or pharmacy name",
  "confidence": 0.0
}
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
      max_tokens: 600,
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
  // Strip markdown fences if the model wraps output anyway
  const jsonText = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()

  try {
    return JSON.parse(jsonText) as MedScanResult
  } catch {
    throw new Error(`Could not parse AI response: ${raw.slice(0, 200)}`)
  }
}
