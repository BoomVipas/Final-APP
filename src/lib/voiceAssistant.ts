/**
 * src/lib/voiceAssistant.ts
 *
 * Client wrapper for the `voice-assistant` Supabase Edge Function.
 *
 * Why a raw fetch instead of `supabase.functions.invoke`:
 *   The SDK wraps non-2xx responses in a `FunctionsHttpError` whose body lives
 *   on a `Response` stream that the caller has to remember to await — making
 *   debug messages like "Edge Function returned a non-2xx status code" useless
 *   in practice. A raw fetch lets us read the body once and surface the real
 *   server reason in the UI.
 *
 * Auth note:
 *   Functions are deployed `--no-verify-jwt`, but the platform-level gateway
 *   still requires the anon key on `apikey` and `Authorization` headers.
 */

import { supabase } from './supabase'
import { getIntentCatalog, type IntentId } from './intents'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/voice-assistant`

export interface VoiceAssistantRequest {
  text?: string
  audio_base64?: string
  audio_mime?: string
  patient_id?: string
  caregiver_id?: string
  conversation_id?: string
  language?: 'th' | 'en'
}

export interface VoiceAssistantMatch {
  prescription_id: string
  chunk_text: string
  similarity: number
}

export interface VoiceAssistantResponse {
  ok: boolean
  conversation_id: string | null
  transcript: string
  reply_text: string
  intent: { id: IntentId; params: Record<string, string> } | null
  audio_base64: string | null
  audio_mime: string | null
  tts_stubbed: boolean
  matches: VoiceAssistantMatch[]
}

export class VoiceAssistantError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`voice-assistant ${status}: ${body.slice(0, 300)}`)
    this.status = status
    this.body = body
  }
}

export async function askVoiceAssistant(
  req: VoiceAssistantRequest,
): Promise<VoiceAssistantResponse> {
  if (!req.text && !req.audio_base64) {
    throw new Error('askVoiceAssistant: provide either text or audio_base64')
  }

  const session = (await supabase.auth.getSession()).data.session
  const authToken = session?.access_token ?? SUPABASE_ANON_KEY

  const body = JSON.stringify({
    ...req,
    intent_catalog: getIntentCatalog(),
  })

  let res: Response
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Network error reaching voice-assistant: ${msg}`)
  }

  const text = await res.text()
  if (!res.ok) {
    console.warn('[voice-assistant] non-2xx', res.status, text.slice(0, 500))
    throw new VoiceAssistantError(res.status, text)
  }

  try {
    return JSON.parse(text) as VoiceAssistantResponse
  } catch {
    throw new Error(
      `voice-assistant returned non-JSON 200 body: ${text.slice(0, 200)}`,
    )
  }
}
