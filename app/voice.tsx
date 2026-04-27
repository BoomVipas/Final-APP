/**
 * app/voice.tsx
 *
 * Voice assistant screen.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  ผู้ช่วยเสียง / Voice Assistant   ◀ Back │
 *   ├─────────────────────────────────────────┤
 *   │  [user bubble] [▶ play] (audio recording)│
 *   │  [assistant bubble] (with [🔊 Replay])  │
 *   │  …                                       │
 *   │                          ┌─────────────┐│
 *   │                          │  🎤 mic FAB ││  ← floats above input
 *   │                          └─────────────┘│
 *   ├──────────────────────────────────────────┤
 *   │ [type question…]                  [➤]   │
 *   └─────────────────────────────────────────┘
 *
 * Why the mic is a floating FAB instead of inline in the input row:
 *   The user sees recording as a deliberate, distinct action — not a tiny icon
 *   next to a keyboard. Apple's voice-memo and Telegram's hold-to-talk both
 *   put the mic outside the text field for the same reason.
 *
 * Native-module guard:
 *   expo-speech and expo-audio ship native modules that need to be in the
 *   dev-client binary. We `require()` them defensively at module load. When
 *   the bindings are missing, the screen falls back to a clean text-only
 *   layout and surfaces a "rebuild" hint instead of crashing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'

import { askVoiceAssistant, type VoiceAssistantResponse } from '../src/lib/voiceAssistant'
import { dispatchIntent, INTENTS, type IntentId } from '../src/lib/intents'
import { useAuthStore } from '../src/stores/authStore'

// ─── Native-module loaders (must not throw at file load) ─────────────────────

type SpeechModule = typeof import('expo-speech')
type AudioModule = typeof import('expo-audio')

let Speech: SpeechModule | null = null
try {
  Speech = require('expo-speech') as SpeechModule
} catch (e) {
  console.warn('[voice] expo-speech native module missing — TTS disabled.', e)
}

let Audio: AudioModule | null = null
try {
  Audio = require('expo-audio') as AudioModule
} catch (e) {
  console.warn('[voice] expo-audio native module missing — mic disabled.', e)
}

// ─── Shared types + helpers ──────────────────────────────────────────────────

interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  audioUri?: string | null
  intent?: { id: IntentId; params: Record<string, string> } | null
  ttsStubbed?: boolean
}

const SUGGESTIONS_TH = ['ตารางยาวันนี้', 'เปิดรายการแจ้งเตือน', 'สแกนฉลากยา']

const COLORS = {
  bg: '#FBF0E3',
  surface: '#FFFFFF',
  border: '#E9DFD2',
  primary: '#E8721A',
  primaryLight: '#F5A74F',
  recording: '#D32F2F',
  textPrimary: '#241F1B',
  textSecondary: '#524C46',
  textMuted: '#A89F94',
  errorBg: '#FCE8E0',
  errorBorder: '#F2C2AE',
  errorText: '#9B2C0F',
  warnBg: '#FFF4E0',
  warnBorder: '#F2D6A6',
  warnText: '#7A4F0E',
}

function detectLanguage(text: string): 'th' | 'en' {
  return /[฀-๿]/.test(text) ? 'th' : 'en'
}

function speakReply(text: string) {
  if (!Speech) return
  Speech.stop()
  const lang = detectLanguage(text)
  Speech.speak(text, {
    language: lang === 'th' ? 'th-TH' : 'en-US',
    rate: 1.0,
    pitch: 1.0,
  })
}

function stopSpeaking() {
  if (!Speech) return
  Speech.stop()
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Top-level screen — all state lives here ─────────────────────────────────

export default function VoiceScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((s) => s.user)
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => () => stopSpeaking(), [])

  const handleResponse = useCallback((res: VoiceAssistantResponse) => {
    if (res.conversation_id) setConversationId(res.conversation_id)
    setTurns((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.reply_text,
        intent: res.intent,
        ttsStubbed: res.tts_stubbed,
      },
    ])
    speakReply(res.reply_text)
  }, [])

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      setError(null)
      setInput('')
      setTurns((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', text: trimmed },
      ])
      setBusy(true)
      try {
        const res = await askVoiceAssistant({
          text: trimmed,
          caregiver_id: user?.id,
          conversation_id: conversationId ?? undefined,
        })
        handleResponse(res)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setBusy(false)
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
      }
    },
    [busy, user?.id, conversationId, handleResponse],
  )

  const sendAudio = useCallback(
    async (audioBase64: string, mime: string, audioUri: string, placeholderId: string) => {
      setBusy(true)
      try {
        const res = await askVoiceAssistant({
          audio_base64: audioBase64,
          audio_mime: mime,
          caregiver_id: user?.id,
          conversation_id: conversationId ?? undefined,
        })
        setTurns((prev) =>
          prev.map((t) =>
            t.id === placeholderId
              ? { ...t, text: res.transcript || '🎙 (no speech detected)', audioUri }
              : t,
          ),
        )
        handleResponse(res)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not process recording')
      } finally {
        setBusy(false)
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
      }
    },
    [user?.id, conversationId, handleResponse],
  )

  const addUserPlaceholder = useCallback((): string => {
    const id = `u-${Date.now()}`
    setTurns((prev) => [...prev, { id, role: 'user', text: '🎙 transcribing…' }])
    return id
  }, [])

  const onIntentPress = useCallback(
    (intentId: IntentId, params: Record<string, string>) => {
      stopSpeaking()
      const result = dispatchIntent(intentId, params, router)
      if (!result.ok) setError(`ไม่สามารถเปิด: ${result.reason ?? 'unknown'}`)
    },
    [router],
  )

  const showRebuildHint = !Audio || !Speech

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ผู้ช่วยเสียง / Voice Assistant',
          headerTintColor: COLORS.primary,
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView className="flex-1" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
            keyboardShouldPersistTaps="handled"
          >
            {turns.length === 0 ? <EmptyState onPick={sendText} /> : null}

            {turns.map((t) => (
              <Bubble key={t.id} turn={t} onIntentPress={onIntentPress} />
            ))}

            {busy ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  marginBottom: 8,
                  borderRadius: 16,
                  backgroundColor: COLORS.surface,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null}

            {error ? (
              <View
                style={{
                  alignSelf: 'stretch',
                  marginTop: 8,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: COLORS.errorBg,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: COLORS.errorBorder,
                }}
              >
                <Text style={{ fontSize: 13, color: COLORS.errorText }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {showRebuildHint ? (
              <View
                style={{
                  alignSelf: 'stretch',
                  marginTop: 8,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: COLORS.warnBg,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: COLORS.warnBorder,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.warnText }}>
                  Voice features (mic + TTS) are disabled — native modules
                  aren't in this dev-client binary. Run{' '}
                  <Text style={{ fontWeight: '600' }}>
                    npx expo prebuild --clean && npx expo run:ios
                  </Text>{' '}
                  to enable them. Text chat works as-is.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Floating mic FAB — only when audio module is present. */}
          {Audio ? (
            <FloatingMicFab
              busy={busy}
              onAudioReady={sendAudio}
              onError={setError}
              onAddUserPlaceholder={addUserPlaceholder}
              bottomOffset={76 + (Platform.OS === 'ios' ? 0 : insets.bottom)}
            />
          ) : null}

          {/* Input row: text + send only. Mic lives separately as the FAB. */}
          <InputRow
            busy={busy}
            input={input}
            onInputChange={setInput}
            onSendText={sendText}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ─── Floating mic FAB (only mounted when expo-audio is available) ────────────

function FloatingMicFab(props: {
  busy: boolean
  onAudioReady: (
    audioBase64: string,
    mime: string,
    audioUri: string,
    placeholderId: string,
  ) => void
  onError: (msg: string) => void
  onAddUserPlaceholder: () => string
  bottomOffset: number
}) {
  const audio = Audio!
  const recorder = audio.useAudioRecorder(audio.RecordingPresets.HIGH_QUALITY)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startedAtRef = useRef<number | null>(null)

  // Tick the elapsed counter while recording so the UI shows seconds passing.
  useEffect(() => {
    if (!isRecording) {
      setElapsed(0)
      startedAtRef.current = null
      return
    }
    startedAtRef.current = Date.now()
    const t = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed((Date.now() - startedAtRef.current) / 1000)
      }
    }, 250)
    return () => clearInterval(t)
  }, [isRecording])

  const start = useCallback(async () => {
    if (props.busy || isRecording) return
    try {
      const perm = await audio.requestRecordingPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(
          'Microphone permission required',
          'PILLo ต้องการเข้าถึงไมโครโฟนเพื่อรับฟังคำถามของคุณ',
        )
        return
      }
      await audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      })
      stopSpeaking()
      await recorder.prepareToRecordAsync()
      recorder.record()
      setIsRecording(true)
    } catch (e) {
      props.onError(e instanceof Error ? e.message : 'Could not start recording')
    }
  }, [props, recorder, isRecording, audio])

  const stop = useCallback(async () => {
    if (!isRecording) return
    setIsRecording(false)
    try {
      await recorder.stop()
      const uri = recorder.uri
      if (!uri) throw new Error('Recording finished but no file URI')
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      if (!base64) throw new Error('Recorded file was empty')
      const placeholderId = props.onAddUserPlaceholder()
      props.onAudioReady(base64, 'audio/m4a', uri, placeholderId)
    } catch (e) {
      props.onError(e instanceof Error ? e.message : 'Could not stop recording')
    }
  }, [isRecording, recorder, props])

  const idleColor = props.busy ? COLORS.border : COLORS.primary

  return (
    <>
      {isRecording ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: props.bottomOffset + 76,
            left: 16,
            right: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: COLORS.recording,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#fff',
                marginRight: 8,
              }}
            />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
              Recording {formatDuration(elapsed)}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.85 }}>
            tap stop to send
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityLabel={isRecording ? 'Stop recording and send' : 'Start recording'}
        onPress={isRecording ? stop : start}
        disabled={props.busy && !isRecording}
        activeOpacity={0.85}
        style={{
          position: 'absolute',
          left: 16,
          bottom: props.bottomOffset,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: isRecording ? COLORS.recording : idleColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={26}
          color={props.busy && !isRecording ? COLORS.textMuted : '#fff'}
        />
      </TouchableOpacity>
    </>
  )
}

// ─── Input row: text + send only ─────────────────────────────────────────────

function InputRow(props: {
  busy: boolean
  input: string
  onInputChange: (v: string) => void
  onSendText: (text: string) => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.surface,
      }}
    >
      <TextInput
        value={props.input}
        onChangeText={props.onInputChange}
        placeholder="พิมพ์คำถาม / Type your question…"
        placeholderTextColor={COLORS.textMuted}
        onSubmitEditing={() => props.onSendText(props.input)}
        returnKeyType="send"
        multiline
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 120,
          borderRadius: 14,
          backgroundColor: COLORS.bg,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 15,
          color: COLORS.textPrimary,
        }}
        editable={!props.busy}
      />

      <TouchableOpacity
        accessibilityLabel="Send"
        onPress={() => props.onSendText(props.input)}
        disabled={props.busy || props.input.trim().length === 0}
        activeOpacity={0.85}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          marginLeft: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            props.busy || props.input.trim().length === 0
              ? COLORS.border
              : COLORS.primary,
        }}
      >
        <Ionicons name="send" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

// ─── Bubbles ─────────────────────────────────────────────────────────────────

function Bubble({
  turn,
  onIntentPress,
}: {
  turn: Turn
  onIntentPress: (intentId: IntentId, params: Record<string, string>) => void
}) {
  const isUser = turn.role === 'user'
  const intentDef = turn.intent ? INTENTS[turn.intent.id] : null

  return (
    <View
      style={{
        marginVertical: 4,
        maxWidth: '85%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: isUser ? COLORS.primary : COLORS.surface,
          borderWidth: isUser ? 0 : 1,
          borderColor: COLORS.border,
        }}
      >
        {/* Voice-memo style player for user audio turns. */}
        {isUser && turn.audioUri && Audio ? (
          <UserAudioPlayer uri={turn.audioUri} />
        ) : null}

        <Text
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: isUser ? '#fff' : COLORS.textPrimary,
          }}
        >
          {turn.text}
        </Text>
      </View>

      {intentDef && turn.intent ? (
        <TouchableOpacity
          accessibilityLabel={`Open ${intentDef.label_en}`}
          onPress={() => onIntentPress(turn.intent!.id, turn.intent!.params)}
          activeOpacity={0.85}
          style={{
            marginTop: 8,
            alignSelf: 'flex-start',
            borderRadius: 12,
            backgroundColor: COLORS.primaryLight,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="arrow-forward-circle" size={18} color="#22201E" />
          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#22201E' }}>
            {intentDef.label_th} / {intentDef.label_en}
          </Text>
        </TouchableOpacity>
      ) : null}

      {!isUser && Speech ? (
        <TouchableOpacity
          accessibilityLabel="Replay"
          onPress={() => speakReply(turn.text)}
          style={{
            marginTop: 4,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Ionicons name="volume-medium" size={14} color={COLORS.textMuted} />
          <Text style={{ marginLeft: 4, fontSize: 11, color: COLORS.textMuted }}>
            Replay
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

// ─── Per-bubble audio player for user-recorded voice ─────────────────────────

function UserAudioPlayer({ uri }: { uri: string }) {
  const audio = Audio!
  const player = audio.useAudioPlayer(uri)
  const [playing, setPlaying] = useState(false)

  // Watch the player's `playing` flag so the icon flips back to ▶ when it ends.
  useEffect(() => {
    const t = setInterval(() => {
      setPlaying(player.playing)
      if (!player.playing && player.currentTime > 0 && player.duration > 0
          && player.currentTime >= player.duration - 0.05) {
        player.seekTo(0)
      }
    }, 200)
    return () => clearInterval(t)
  }, [player])

  const onToggle = () => {
    if (player.playing) {
      player.pause()
    } else {
      if (player.currentTime >= player.duration && player.duration > 0) {
        player.seekTo(0)
      }
      player.play()
    }
  }

  const duration = player.duration > 0 ? formatDuration(player.duration) : '--:--'

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <TouchableOpacity
        accessibilityLabel={playing ? 'Pause recording' : 'Play recording'}
        onPress={onToggle}
        activeOpacity={0.8}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        }}
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={16}
          color={COLORS.primary}
        />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.4)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#fff',
              width:
                player.duration > 0
                  ? `${Math.min(100, (player.currentTime / player.duration) * 100)}%`
                  : '0%',
            }}
          />
        </View>
      </View>
      <Text style={{ marginLeft: 8, fontSize: 11, color: '#fff', minWidth: 36, textAlign: 'right' }}>
        {duration}
      </Text>
    </View>
  )
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={{ marginTop: 16, marginBottom: 24 }}>
      <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 10 }}>
        ลองถามคำถามเกี่ยวกับยาของผู้ป่วย หรือสั่งให้เปิดหน้าจอที่ต้องการ.
      </Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 12 }}>
        Try asking about a patient's medications, or tell me a screen to open.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {SUGGESTIONS_TH.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            style={{
              marginRight: 8,
              marginBottom: 8,
              borderRadius: 999,
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
