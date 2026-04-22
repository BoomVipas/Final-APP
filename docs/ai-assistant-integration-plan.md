# AI Assistant Integration — Future Feature

> Status: Parked — implement after core app functionality (F-1 through F-4) is stable.

## What it needs to do
- Caregiver (or patient) can **text** a question to the AI assistant
- Caregiver (or patient) can send a **voice message** to the AI
- AI responds **instantly** (low-latency, streaming preferred)

---

## Recommended Tech Stack

### AI / LLM
| Layer | Choice | Why |
|-------|--------|-----|
| Model | **Claude claude-sonnet-4-6** (`claude-sonnet-4-6`) | Already in the project stack; best balance of speed + quality for medical Q&A |
| API | **Anthropic Messages API** with streaming | Enables token-by-token streaming so the first words appear immediately |

### Voice Input (Speech → Text)
| Option | Notes |
|--------|-------|
| **Expo `expo-av` + OpenAI Whisper API** | Record audio on device → POST to Whisper → get transcript → send to Claude |
| **Google Cloud Speech-to-Text** | Higher accuracy for Thai; supports real-time streaming transcription |
| **Deepgram** | Low-latency streaming STT; Thai language support available |

**Recommended**: Start with OpenAI Whisper (simpler, good Thai support). Upgrade to Deepgram streaming if latency is a concern.

### Voice Output (Text → Speech)
- **ElevenLabs TTS** — already in the stack (`ELEVENLABS_API_KEY` in env). Use for AI voice responses.
- Stream audio chunks as they arrive for near-instant playback.

### Infrastructure
| Component | Choice |
|-----------|--------|
| AI request handler | **Supabase Edge Function** (`/functions/ai-assistant/`) |
| Streaming transport | Edge Function supports streaming responses (Deno) |
| Conversation history | **Supabase table** `ai_conversations` (patient_id, caregiver_id, role, content, created_at) |
| Rate limiting | Per-caregiver limit inside Edge Function |

### Data Flow
```
Caregiver types/records → [Expo App]
    ↓  text or audio blob
[Supabase Edge Function: ai-assistant]
    → (if audio) POST to Whisper → transcript
    → fetch patient context from DB (medications, allergies, recent logs)
    → stream request to Claude claude-sonnet-4-6 with system prompt + patient context
    ↓  streaming tokens
[Expo App] renders text in real-time
    → (optional) stream tokens to ElevenLabs TTS → play audio
```

### System Prompt Strategy
The Edge Function should inject:
- Patient's active medications and dosages
- Known allergies
- Recent medication logs (last 24h)
- Current ward / caregiver context
- Language preference (Thai primary)

This keeps the assistant grounded in real patient data without exposing it to the client.

---

## Key Files to Create (when ready)
- `supabase/functions/ai-assistant/index.ts` — Edge Function with streaming
- `app/ai-assistant.tsx` — Chat UI screen
- `src/components/shared/VoiceRecorder.tsx` — Record + upload audio
- `src/lib/elevenlabs.ts` — TTS helper (may already exist or extend `src/lib/`)

## Environment Variables Needed
```
OPENAI_API_KEY=        # for Whisper STT (or use Deepgram)
# ElevenLabs already in stack
# Anthropic already in stack
```

## Notes
- Keep AI responses short and in Thai-first format
- Do NOT let the AI modify medication records — read-only context only
- Log all AI interactions to `notification_logs` or a dedicated `ai_conversations` table for audit trail