// voice-assistant — bilingual (Thai/English) voice assistant for caregivers.
// Pipeline (PDF §10.3.2):
//   audio → Whisper (or skip if `text` provided) → embed query →
//   match_prescriptions RPC → Claude (RAG + intent catalog) → ElevenLabs TTS
//
// ElevenLabs is OPTIONAL: if neither `ELEVENLABS_API_KEY` nor the voice-id
// secrets are set, the function returns reply text only (`tts_stubbed: true`).
// The moment the secrets ship the function starts emitting `audio_base64`
// without any code change.
//
// Required Supabase secrets:
//   OPENAI_API_KEY        (Whisper + embeddings)
//   ANTHROPIC_API_KEY     (Claude)
// Optional Supabase secrets (TTS):
//   ELEVENLABS_API_KEY
//   ELEVENLABS_VOICE_ID_TH
//   ELEVENLABS_VOICE_ID_EN
//
// Deploy `--no-verify-jwt` (anon-key format from devAuth bypass is not a JWT):
//   supabase functions deploy voice-assistant --no-verify-jwt

import { handleCorsPreFlight, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntentDef {
  id: string
  label_en: string
  label_th: string
  description: string
  required_params?: string[]
}

interface VoiceRequest {
  // Provide ONE of these as the user input:
  text?: string
  audio_base64?: string
  audio_mime?: string

  // Optional context
  patient_id?: string
  caregiver_id?: string
  conversation_id?: string
  intent_catalog?: IntentDef[]
  language?: 'th' | 'en'
}

interface ClaudeOutput {
  reply_text: string
  intent_id?: string | null
  params?: Record<string, string> | null
}

interface MatchRow {
  id: string
  prescription_id: string
  patient_id: string
  chunk_text: string
  metadata: Record<string, unknown>
  similarity: number
}

const EMBEDDING_MODEL = 'text-embedding-3-small'
const WHISPER_MODEL = 'whisper-1'
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const MATCH_COUNT = 5

// ─── Whisper ─────────────────────────────────────────────────────────────────

async function transcribeAudio(
  b64: string,
  mime: string,
  openaiKey: string,
): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const ext = mime.split('/')[1]?.split(';')[0] || 'webm'

  const form = new FormData()
  form.append('file', blob, `audio.${ext}`)
  form.append('model', WHISPER_MODEL)
  // Whisper auto-detects language; this is a hint for ambiguous short clips.
  form.append('language', 'th')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Whisper ${res.status}: ${errBody.slice(0, 300)}`)
  }
  const json = (await res.json()) as { text: string }
  return json.text.trim()
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

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
  return json.data[0].embedding
}

// ─── Claude (RAG + intent extraction) ────────────────────────────────────────

function buildSystemPrompt(args: {
  matches: MatchRow[]
  intentCatalog: IntentDef[]
}): string {
  const { matches, intentCatalog } = args

  const contextBlock =
    matches.length > 0
      ? matches
          .map(
            (m, i) =>
              `[doc ${i + 1} (similarity=${m.similarity.toFixed(3)})]\n${m.chunk_text}`,
          )
          .join('\n\n')
      : '(no matching prescription records found)'

  const intentList =
    intentCatalog.length > 0
      ? intentCatalog
          .map((it) => {
            const req = it.required_params?.length
              ? ` [requires: ${it.required_params.join(', ')}]`
              : ''
            return `- ${it.id}: ${it.label_en} / ${it.label_th} — ${it.description}${req}`
          })
          .join('\n')
      : '(no intents — reply with text only)'

  return `You are PILLo, a bilingual (Thai/English) voice assistant for caregivers in a Thai elderly care facility. You answer questions about patient prescriptions and you can navigate the app by emitting an intent.

Rules:
- Reply in the same language as the user's question (Thai if Thai input, else English).
- Keep replies to 1–2 short sentences. Output is read aloud.
- Use ONLY information from the retrieved prescription documents below. Never invent dosages or drug names.
- If the answer is not in the documents, say so briefly.
- If the user wants to navigate or take an action, set "intent_id" to one of the available intents below and fill in any required params from the documents. Otherwise leave intent_id null.
- ALWAYS respond with valid JSON only — no markdown, no prose around it:
  { "reply_text": "...", "intent_id": "..." | null, "params": { ... } | null }

Available intents:
${intentList}

Retrieved prescription documents:
${contextBlock}`
}

async function callClaude(args: {
  query: string
  matches: MatchRow[]
  intentCatalog: IntentDef[]
  anthropicKey: string
}): Promise<ClaudeOutput> {
  const { query, matches, intentCatalog, anthropicKey } = args
  const systemPrompt = buildSystemPrompt({ matches, intentCatalog })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Claude ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>
  }
  const textBlock = json.content.find((c) => c.type === 'text' && c.text)
  if (!textBlock?.text) throw new Error('Claude returned no text block')

  const raw = textBlock.text.trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { reply_text: raw }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeOutput
    return {
      reply_text: parsed.reply_text ?? raw,
      intent_id: parsed.intent_id ?? null,
      params: parsed.params ?? null,
    }
  } catch {
    return { reply_text: raw }
  }
}

// ─── ElevenLabs TTS (optional — stub returns null if not configured) ─────────

async function ttsElevenLabs(args: {
  text: string
  language: 'th' | 'en'
}): Promise<{ audio_base64: string; mime: string } | null> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
  const voiceId =
    args.language === 'th'
      ? Deno.env.get('ELEVENLABS_VOICE_ID_TH')
      : Deno.env.get('ELEVENLABS_VOICE_ID_EN')

  if (!apiKey || !voiceId) return null

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: args.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { audio_base64: btoa(binary), mime: 'audio/mpeg' }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLanguage(text: string): 'th' | 'en' {
  return /[฀-๿]/.test(text) ? 'th' : 'en'
}

interface ConversationTurn {
  role: 'user' | 'assistant'
  text: string
  ts: string
}

async function persistConversation(args: {
  supabase: ReturnType<typeof createServiceClient>
  caregiverId: string
  conversationId: string | null
  turns: ConversationTurn[]
}): Promise<string | null> {
  const { supabase, caregiverId, conversationId, turns } = args

  if (conversationId) {
    const { data: existing, error: readErr } = await supabase
      .from('voice_conversations')
      .select('transcript')
      .eq('id', conversationId)
      .maybeSingle()
    if (readErr) throw new Error(`conversation read: ${readErr.message}`)
    const prior = (existing?.transcript as ConversationTurn[]) ?? []
    const merged = [...prior, ...turns]
    const { error: updateErr } = await supabase
      .from('voice_conversations')
      .update({ transcript: merged })
      .eq('id', conversationId)
    if (updateErr) throw new Error(`conversation update: ${updateErr.message}`)
    return conversationId
  }

  const { data: created, error: insertErr } = await supabase
    .from('voice_conversations')
    .insert({ caregiver_id: caregiverId, transcript: turns })
    .select('id')
    .single()
  if (insertErr) throw new Error(`conversation insert: ${insertErr.message}`)
  return created?.id ?? null
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleCorsPreFlight()
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405)

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!openaiKey) return errorResponse('OPENAI_API_KEY not configured', 500)
  if (!anthropicKey) return errorResponse('ANTHROPIC_API_KEY not configured', 500)

  let body: VoiceRequest
  try {
    body = (await req.json()) as VoiceRequest
  } catch {
    return errorResponse('Invalid JSON body')
  }

  try {
    // 1. Resolve user text (transcribe if audio).
    let userText: string
    if (body.text && body.text.trim().length > 0) {
      userText = body.text.trim()
    } else if (body.audio_base64) {
      const mime = body.audio_mime ?? 'audio/m4a'
      userText = await transcribeAudio(body.audio_base64, mime, openaiKey)
    } else {
      return errorResponse('Provide either `text` or `audio_base64`')
    }
    if (!userText) return errorResponse('Empty user input after transcription')

    // 2. Embed + RAG.
    const supabase = createServiceClient()
    const queryEmbedding = await embedText(userText, openaiKey)
    const { data: matchData, error: matchErr } = await supabase.rpc(
      'match_prescriptions',
      {
        query_embedding: queryEmbedding,
        match_count: MATCH_COUNT,
        filter_patient_id: body.patient_id ?? null,
      },
    )
    if (matchErr) throw new Error(`match_prescriptions: ${matchErr.message}`)
    const matches = (matchData ?? []) as MatchRow[]

    // 3. Claude (RAG + intent extraction).
    const claudeOut = await callClaude({
      query: userText,
      matches,
      intentCatalog: body.intent_catalog ?? [],
      anthropicKey,
    })

    // 4. TTS (stubbed when secrets absent).
    const language = body.language ?? detectLanguage(claudeOut.reply_text)
    let audio: { audio_base64: string; mime: string } | null = null
    let ttsError: string | null = null
    let ttsReason: string | null = null
    const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
    const voiceIdTh = Deno.env.get('ELEVENLABS_VOICE_ID_TH')
    const voiceIdEn = Deno.env.get('ELEVENLABS_VOICE_ID_EN')
    if (!elevenKey) ttsReason = 'missing ELEVENLABS_API_KEY'
    else if (language === 'th' && !voiceIdTh) ttsReason = 'missing ELEVENLABS_VOICE_ID_TH'
    else if (language === 'en' && !voiceIdEn) ttsReason = 'missing ELEVENLABS_VOICE_ID_EN'
    if (!ttsReason) {
      try {
        audio = await ttsElevenLabs({ text: claudeOut.reply_text, language })
      } catch (err) {
        ttsError = err instanceof Error ? err.message : String(err)
        console.error('[voice-assistant] TTS failed:', ttsError)
      }
    }

    // 5. Persist conversation if caregiver_id provided.
    let conversationId = body.conversation_id ?? null
    if (body.caregiver_id) {
      const now = new Date().toISOString()
      conversationId = await persistConversation({
        supabase,
        caregiverId: body.caregiver_id,
        conversationId,
        turns: [
          { role: 'user', text: userText, ts: now },
          { role: 'assistant', text: claudeOut.reply_text, ts: now },
        ],
      })
    }

    return jsonResponse({
      ok: true,
      conversation_id: conversationId,
      transcript: userText,
      reply_text: claudeOut.reply_text,
      intent: claudeOut.intent_id
        ? { id: claudeOut.intent_id, params: claudeOut.params ?? {} }
        : null,
      audio_base64: audio?.audio_base64 ?? null,
      audio_mime: audio?.mime ?? null,
      tts_stubbed: !audio,
      tts_reason: ttsReason,
      tts_error: ttsError,
      matches: matches.map((m) => ({
        prescription_id: m.prescription_id,
        chunk_text: m.chunk_text,
        similarity: m.similarity,
      })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[voice-assistant]', msg)
    return errorResponse(msg, 500)
  }
})
