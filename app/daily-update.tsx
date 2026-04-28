/**
 * app/daily-update.tsx
 *
 * Composite "daily family update" composer — V/S, meal, and shift sections
 * in one screen. Each section is opt-in via toggle. One LINE Flex Message
 * goes out with all selected sections. Bypasses quiet hours.
 *
 * Drawn from the real-world LINE chat patterns the care center uses:
 * 🌻 วัด V/S 🌻 + meal report + ส่งเวร handover.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/authStore'
import { USE_MOCK } from '../src/mocks'
import {
  sendDailyUpdate,
  type DailyMeal,
  type DailyShift,
  type DailyVitals,
  type MealPortion,
  type MealType,
  type ShiftLetter,
  type ShiftSleep,
} from '../src/lib/lineNotifier'
import {
  pickPhotoFromLibrary,
  takePhotoWithCamera,
  uploadPhotoForPatient,
  type PickedPhoto,
} from '../src/lib/photoUpload'
import type { FamilyContactsRow } from '../src/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatBuddhistDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`
}

function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function defaultMealForNow(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'noon'
  return 'evening'
}

function defaultShiftForNow(): ShiftLetter {
  const h = new Date().getHours()
  if (h < 8) return 'N'
  if (h < 16) return 'M'
  return 'D'
}

// ─── Static labels ───────────────────────────────────────────────────────────

const MEAL_TYPE_OPTIONS: Array<{ id: MealType; label_th: string; label_en: string; emoji: string }> = [
  { id: 'breakfast', label_th: 'มื้อเช้า', label_en: 'Breakfast', emoji: '🌅' },
  { id: 'noon', label_th: 'มื้อกลางวัน', label_en: 'Noon', emoji: '☀️' },
  { id: 'evening', label_th: 'มื้อเย็น', label_en: 'Evening', emoji: '🌆' },
]

const PORTION_OPTIONS: Array<{ id: MealPortion; label_th: string; label_en: string; emoji: string }> = [
  { id: 'all', label_th: 'ทานหมด', label_en: 'All', emoji: '✅' },
  { id: 'half', label_th: 'ทานครึ่งหนึ่ง', label_en: 'Half', emoji: '🟡' },
  { id: 'little', label_th: 'ทานน้อย', label_en: 'A little', emoji: '🟠' },
  { id: 'none', label_th: 'ไม่ทาน', label_en: 'None', emoji: '🔴' },
]

const SHIFT_OPTIONS: Array<{ id: ShiftLetter; label_th: string; label_en: string }> = [
  { id: 'M', label_th: 'เวรเช้า', label_en: 'Morning (M)' },
  { id: 'D', label_th: 'เวรกลางวัน', label_en: 'Day (D)' },
  { id: 'N', label_th: 'เวรกลางคืน', label_en: 'Night (N)' },
]

const SLEEP_OPTIONS: Array<{ id: ShiftSleep; label_th: string; label_en: string; emoji: string }> = [
  { id: 'good', label_th: 'หลับดี', label_en: 'Slept well', emoji: '😴' },
  { id: 'restless', label_th: 'กระสับกระส่าย', label_en: 'Restless', emoji: '😟' },
  { id: 'frequent_waking', label_th: 'ตื่นบ่อย', label_en: 'Frequent waking', emoji: '🔁' },
  { id: 'no_sleep', label_th: 'ไม่ได้นอน', label_en: 'Did not sleep', emoji: '⚠️' },
]

const PORTION_LABEL_TH: Record<MealPortion, string> = {
  all: 'ทานหมด',
  half: 'ทานครึ่งหนึ่ง',
  little: 'ทานน้อย',
  none: 'ไม่ทาน',
}

const SLEEP_LABEL_TH: Record<ShiftSleep, string> = {
  good: 'หลับดี',
  restless: 'กระสับกระส่าย',
  frequent_waking: 'ตื่นบ่อย',
  no_sleep: 'ไม่ได้นอน',
}

const MEAL_LABEL_TH: Record<MealType, string> = {
  breakfast: 'อาหารมื้อเช้า',
  noon: 'อาหารมื้อกลางวัน',
  evening: 'อาหารมื้อเย็น',
}

const SHIFT_LABEL_TH: Record<ShiftLetter, string> = {
  M: 'เวรเช้า',
  D: 'เวรกลางวัน',
  N: 'เวรกลางคืน',
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DailyUpdateScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()
  const patientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId
  const patientName =
    (Array.isArray(params.patientName) ? params.patientName[0] : params.patientName) ?? 'Patient'
  const { user } = useAuthStore()
  // Family-facing signature is the care centre's name, not the individual
  // caregiver — families don't need to know which caregiver is on duty.
  // EXPO_PUBLIC_CARE_CENTER_NAME lets each facility customise without a code change.
  const careCenterName = process.env.EXPO_PUBLIC_CARE_CENTER_NAME || 'ศูนย์ดูแลแสนสุข'
  const caregiverName = careCenterName
  void user // kept around so the auth-store import / future per-caregiver fields don't break

  const [contacts, setContacts] = useState<FamilyContactsRow[]>([])
  const [contactsLoading, setContactsLoading] = useState(true)

  // Section toggles
  const [includeVitals, setIncludeVitals] = useState(true)
  const [includeMeal, setIncludeMeal] = useState(false)
  const [includeShift, setIncludeShift] = useState(false)

  // Date / time (defaults to now, editable)
  const [now] = useState(() => new Date())
  const [dateBE, setDateBE] = useState(() => formatBuddhistDate(now))
  const [time, setTime] = useState(() => formatTime(now))

  // V/S fields
  const [vT, setVT] = useState('')
  const [vP, setVP] = useState('')
  const [vR, setVR] = useState('')
  const [vBPsys, setVBPsys] = useState('')
  const [vBPdia, setVBPdia] = useState('')
  const [vO2, setVO2] = useState('')
  const [vUrine, setVUrine] = useState('')
  const [vStool, setVStool] = useState('')

  // Meal fields
  const [mealType, setMealType] = useState<MealType>(defaultMealForNow())
  const [mealPortion, setMealPortion] = useState<MealPortion>('all')
  const [mealFood, setMealFood] = useState('')

  // Shift fields
  const [shiftLetter, setShiftLetter] = useState<ShiftLetter>(defaultShiftForNow())
  const [shiftSleep, setShiftSleep] = useState<ShiftSleep>('good')
  const [shiftNotes, setShiftNotes] = useState('')

  // Photo
  const [photo, setPhoto] = useState<PickedPhoto | null>(null)

  // Send state
  const [sending, setSending] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!patientId) {
      setContactsLoading(false)
      return
    }
    if (USE_MOCK) {
      setContacts([])
      setContactsLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('family_contacts')
      .select('id, patient_id, name, line_user_id')
      .eq('patient_id', patientId)
      .not('line_user_id', 'is', null)
      .then(({ data }) => {
        if (cancelled) return
        setContacts((data ?? []) as FamilyContactsRow[])
        setContactsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const reachableCount = contacts.length

  const builtPayload = useMemo(() => {
    const vitals: DailyVitals | undefined = includeVitals
      ? {
          T: vT.trim() || undefined,
          P: vP.trim() || undefined,
          R: vR.trim() || undefined,
          BP_sys: vBPsys.trim() || undefined,
          BP_dia: vBPdia.trim() || undefined,
          O2: vO2.trim() || undefined,
          urine: vUrine.trim() || undefined,
          stool: vStool.trim() || undefined,
        }
      : undefined

    const meal: DailyMeal | undefined = includeMeal
      ? {
          meal_type: mealType,
          portion: mealPortion,
          food: mealFood.trim(),
        }
      : undefined

    const shift: DailyShift | undefined = includeShift
      ? {
          shift_letter: shiftLetter,
          sleep: shiftSleep,
          notes: shiftNotes.trim(),
        }
      : undefined

    return { vitals, meal, shift }
  }, [
    includeVitals, includeMeal, includeShift,
    vT, vP, vR, vBPsys, vBPdia, vO2, vUrine, vStool,
    mealType, mealPortion, mealFood,
    shiftLetter, shiftSleep, shiftNotes,
  ])

  const hasAnySection = !!(builtPayload.vitals || builtPayload.meal || builtPayload.shift)
  const canPreview = hasAnySection && !!patientId
  const canSend = canPreview && reachableCount > 0 && !sending

  const onPickFromLibrary = async () => {
    try {
      const picked = await pickPhotoFromLibrary()
      if (picked) setPhoto(picked)
    } catch (e) {
      Alert.alert('Photo error', e instanceof Error ? e.message : 'Could not pick photo')
    }
  }

  const onTakePhoto = async () => {
    try {
      const picked = await takePhotoWithCamera()
      if (picked) setPhoto(picked)
    } catch (e) {
      Alert.alert('Camera error', e instanceof Error ? e.message : 'Could not open camera')
    }
  }

  const onSend = async () => {
    if (!canSend || !patientId) return
    if (USE_MOCK) {
      Alert.alert(
        'Mock mode',
        `Would send daily update to ${reachableCount} LINE contact${reachableCount === 1 ? '' : 's'}.`,
      )
      setPreviewOpen(false)
      return
    }
    setSending(true)
    try {
      let photoUrl: string | undefined
      if (photo) {
        const uploaded = await uploadPhotoForPatient({ photo, patientId })
        photoUrl = uploaded.publicUrl
      }

      const result = await sendDailyUpdate({
        patientId,
        payload: {
          patient_name: patientName,
          caregiver_name: caregiverName,
          date_be: dateBE,
          time,
          vitals: builtPayload.vitals,
          meal: builtPayload.meal,
          shift: builtPayload.shift,
          photo_url: photoUrl,
        },
      })

      const summary = `Sent ${result.sent}  ·  Failed ${result.failed}  ·  Skipped ${result.skipped}`
      Alert.alert('Daily update sent', summary, [
        {
          text: 'OK',
          onPress: () => {
            setPreviewOpen(false)
            router.back()
          },
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed'
      Alert.alert('Could not send', message)
    } finally {
      setSending(false)
    }
  }

  if (!patientId) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 16, color: '#2F2D2B', textAlign: 'center' }}>
          Open this screen from a patient profile.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.fallbackBtn}>
          <Text style={{ color: '#2E2C2A', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F4EE' }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#FFF7ED', '#FBD7A8', '#F3A449']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 }}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#2F2D2B" />
        </Pressable>
        <Text style={{ marginTop: 18, fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#2F2D2B' }}>
          📋 รายงานครอบครัว
        </Text>
        <Text style={{ marginTop: 4, fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#3A1F11' }}>
          Daily family update · {patientName}
        </Text>
        <Text style={{ marginTop: 8, fontSize: 13, color: '#5C554E' }}>
          วันที่ {dateBE}  เวลา {time} น.
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 160 }}>
          {/* ───── Photo section (top of form) ───── */}
          <Text style={styles.sectionLabel}>รูปภาพ (ตัวเลือก) · PHOTO (OPTIONAL)</Text>
          {photo ? (
            <View style={{ marginTop: 10 }}>
              <Image
                source={{ uri: photo.uri }}
                style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: '#EFE4D5' }}
                resizeMode="cover"
              />
              <TouchableOpacity onPress={() => setPhoto(null)} style={styles.removePhotoBtn}>
                <Ionicons name="close-circle" size={20} color="#A3322A" />
                <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: '700', color: '#A3322A' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity onPress={onTakePhoto} style={styles.photoBtn}>
                <Ionicons name="camera-outline" size={20} color="#8E4B14" />
                <Text style={styles.photoBtnText}>ถ่ายรูป / Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onPickFromLibrary} style={styles.photoBtn}>
                <Ionicons name="images-outline" size={20} color="#8E4B14" />
                <Text style={styles.photoBtnText}>เลือกรูป / Library</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recipient summary */}
          <View style={[styles.recipientPill, { marginTop: 18 }]}>
            {contactsLoading ? (
              <ActivityIndicator size="small" color="#8E4B14" />
            ) : reachableCount > 0 ? (
              <>
                <Ionicons name="chatbubbles" size={16} color="#1B5E20" />
                <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#1B5E20' }}>
                  Will send to {reachableCount} LINE contact{reachableCount === 1 ? '' : 's'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle" size={16} color="#A3322A" />
                <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#A3322A' }}>
                  No LINE-linked contacts on file
                </Text>
              </>
            )}
          </View>

          {/* Date / time editable */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 2 }}>
              <FieldLabel>วันที่ / Date (BE)</FieldLabel>
              <FieldInput value={dateBE} onChangeText={setDateBE} placeholder="DD/MM/YYYY" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>เวลา / Time</FieldLabel>
              <FieldInput value={time} onChangeText={setTime} placeholder="HH:MM" />
            </View>
          </View>

          {/* ───── V/S section ───── */}
          <SectionToggle
            title="🌻 วัด V/S"
            subtitle="Vital signs"
            on={includeVitals}
            onPress={() => setIncludeVitals((v) => !v)}
          />
          {includeVitals ? (
            <View style={styles.sectionBody}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <NumField label="T (°C)" value={vT} onChangeText={setVT} />
                <NumField label="P (bpm)" value={vP} onChangeText={setVP} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <NumField label="R (ครั้ง/นาที)" value={vR} onChangeText={setVR} />
                <NumField label="O₂ (%)" value={vO2} onChangeText={setVO2} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <NumField label="BP sys" value={vBPsys} onChangeText={setVBPsys} />
                <NumField label="BP dia" value={vBPdia} onChangeText={setVBPdia} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <NumField label="Urine (ml)" value={vUrine} onChangeText={setVUrine} />
                <NumField label="Stool (ครั้ง)" value={vStool} onChangeText={setVStool} />
              </View>
            </View>
          ) : null}

          {/* ───── Meal section ───── */}
          <SectionToggle
            title="🍽️ มื้ออาหาร"
            subtitle="Meal report"
            on={includeMeal}
            onPress={() => setIncludeMeal((v) => !v)}
          />
          {includeMeal ? (
            <View style={styles.sectionBody}>
              <FieldLabel>มื้อ / Meal</FieldLabel>
              <ChipRow>
                {MEAL_TYPE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={mealType === opt.id}
                    onPress={() => setMealType(opt.id)}
                    label={`${opt.emoji} ${opt.label_th}`}
                  />
                ))}
              </ChipRow>

              <FieldLabel>ปริมาณที่ทาน / Portion</FieldLabel>
              <ChipRow>
                {PORTION_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={mealPortion === opt.id}
                    onPress={() => setMealPortion(opt.id)}
                    label={`${opt.emoji} ${opt.label_th}`}
                  />
                ))}
              </ChipRow>

              <FieldLabel>รายการอาหาร / What they ate</FieldLabel>
              <FieldInput
                value={mealFood}
                onChangeText={setMealFood}
                placeholder="เช่น ข้าวไข่เจียว แก้วมังกร มะละกอ"
                multiline
                style={{ minHeight: 80 }}
              />
            </View>
          ) : null}

          {/* ───── Shift section ───── */}
          <SectionToggle
            title="📋 ส่งเวร"
            subtitle="Shift handover"
            on={includeShift}
            onPress={() => setIncludeShift((v) => !v)}
          />
          {includeShift ? (
            <View style={styles.sectionBody}>
              <FieldLabel>เวร / Shift</FieldLabel>
              <ChipRow>
                {SHIFT_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={shiftLetter === opt.id}
                    onPress={() => setShiftLetter(opt.id)}
                    label={opt.label_th}
                  />
                ))}
              </ChipRow>

              <FieldLabel>การนอน / Sleep</FieldLabel>
              <ChipRow>
                {SLEEP_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.id}
                    active={shiftSleep === opt.id}
                    onPress={() => setShiftSleep(opt.id)}
                    label={`${opt.emoji} ${opt.label_th}`}
                  />
                ))}
              </ChipRow>

              <FieldLabel>หมายเหตุ / Notes</FieldLabel>
              <FieldInput
                value={shiftNotes}
                onChangeText={setShiftNotes}
                placeholder="เช่น ทานยาก่อนนอน หายใจปกติ"
                multiline
                style={{ minHeight: 80 }}
              />
            </View>
          ) : null}

          <Text style={{ marginTop: 22, fontSize: 12, color: '#857E76', lineHeight: 18 }}>
            ลงชื่ออัตโนมัติว่า {caregiverName} ค่ะ. Auto-signed as {caregiverName}.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => setPreviewOpen(true)}
            disabled={!canPreview}
            style={[styles.primaryBtn, !canPreview && { backgroundColor: '#E8DBC8' }]}
          >
            <Ionicons name="eye-outline" size={20} color="#2E2C2A" />
            <Text style={styles.primaryBtnText}>ดูตัวอย่าง / Preview</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ───── Preview Modal ───── */}
      <Modal visible={previewOpen} transparent animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !sending && setPreviewOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#8E4B14', letterSpacing: 1 }}>PREVIEW</Text>
            <Text style={{ marginTop: 6, fontSize: 22, fontWeight: '700', color: '#2E241B' }}>
              How it appears in LINE
            </Text>

            <ScrollView
              style={{ flex: 1, marginTop: 14 }}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator
            >
              {/* LINE chat thread styling: dark backdrop, OA avatar + name, then the bubble */}
              <View style={styles.lineChatBackdrop}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <View style={styles.lineAvatar}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1B5E20' }}>P</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontSize: 12, color: '#C9C9C9', marginBottom: 4 }}>PILLo</Text>
                    <PreviewBubble
                      patientName={patientName}
                      caregiverName={caregiverName}
                      dateBE={dateBE}
                      time={time}
                      vitals={builtPayload.vitals}
                      meal={builtPayload.meal}
                      shift={builtPayload.shift}
                      photoUri={photo?.uri ?? null}
                    />
                    <Text style={{ fontSize: 10, color: '#8A8A8A', marginTop: 4 }}>
                      {time} น.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setPreviewOpen(false)}
                disabled={sending}
                style={styles.cancelBtn}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#2E241B' }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSend}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && { backgroundColor: '#E8DBC8' }]}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.sendBtnText}>ส่ง LINE / Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Preview bubble (mirrors the Flex Message render) ────────────────────────

function PreviewBubble({
  patientName,
  caregiverName,
  dateBE,
  time,
  vitals,
  meal,
  shift,
  photoUri,
}: {
  patientName: string
  caregiverName: string
  dateBE: string
  time: string
  vitals?: DailyVitals
  meal?: DailyMeal
  shift?: DailyShift
  photoUri: string | null
}) {
  return (
    <View style={{ borderRadius: 18, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#EFE4D5' }}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: '100%', height: 180, backgroundColor: '#EFE4D5' }} resizeMode="cover" />
      ) : null}

      <View style={{ backgroundColor: '#FFF3E5', padding: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#8E4B14' }}>📋 รายงานประจำวัน</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: '#444' }}>ผู้ป่วย: {patientName}</Text>
      </View>

      <View style={{ padding: 14 }}>
        {vitals ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ textAlign: 'center', fontWeight: '700', color: '#8E4B14' }}>🌻 วัด V/S 🌻</Text>
            <Text style={{ textAlign: 'center', fontSize: 11, color: '#888', marginTop: 2 }}>
              วันที่ {dateBE}  เวลา {time} น.
            </Text>
            <View style={{ height: 1, backgroundColor: '#EFE4D5', marginVertical: 8 }} />
            {vitals.T ? <PreviewVital label="T" value={`${vitals.T}°C`} /> : null}
            {vitals.P ? <PreviewVital label="P" value={`${vitals.P} bpm`} /> : null}
            {vitals.R ? <PreviewVital label="R" value={`${vitals.R} ครั้ง/นาที`} /> : null}
            {vitals.BP_sys && vitals.BP_dia ? <PreviewVital label="BP" value={`${vitals.BP_sys}/${vitals.BP_dia} mmHg`} /> : null}
            {vitals.O2 ? <PreviewVital label="O₂" value={`${vitals.O2} %`} /> : null}
            {vitals.urine ? <PreviewVital label="Urine" value={`${vitals.urine} ml`} /> : null}
            {vitals.stool ? <PreviewVital label="Stool" value={`${vitals.stool} ครั้ง`} /> : null}
          </View>
        ) : null}

        {meal ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: '#8E4B14' }}>🍽️ {MEAL_LABEL_TH[meal.meal_type]}</Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: '#444' }}>{PORTION_LABEL_TH[meal.portion]}</Text>
            {meal.food ? <Text style={{ marginTop: 4, fontSize: 13, color: '#444' }}>{meal.food}</Text> : null}
          </View>
        ) : null}

        {shift ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: '#8E4B14' }}>📋 {SHIFT_LABEL_TH[shift.shift_letter]} ({shift.shift_letter})</Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: '#444' }}>{SLEEP_LABEL_TH[shift.sleep]}</Text>
            {shift.notes ? <Text style={{ marginTop: 4, fontSize: 13, color: '#444' }}>{shift.notes}</Text> : null}
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: '#EFE4D5', marginVertical: 4 }} />
        <Text style={{ fontSize: 11, color: '#888', textAlign: 'right', marginTop: 8 }}>— {caregiverName} ค่ะ</Text>
      </View>
    </View>
  )
}

function PreviewVital({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
      <Text style={{ flex: 1, fontSize: 13, color: '#666' }}>{label}</Text>
      <Text style={{ flex: 2, fontSize: 13, fontWeight: '700', color: '#1B5E20', textAlign: 'right' }}>{value}</Text>
    </View>
  )
}

// ─── Reusable bits ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: '700', color: '#5E5145' }}>
      {children}
    </Text>
  )
}

function FieldInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#B0A89E"
      {...props}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#EADBCB',
          backgroundColor: '#FFFDF8',
          fontSize: 14,
          color: '#2E241B',
          textAlignVertical: 'top',
        },
        props.style,
      ]}
    />
  )
}

function NumField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#5E5145', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="—"
        placeholderTextColor="#B0A89E"
        keyboardType="decimal-pad"
        style={{
          minHeight: 44,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#EADBCB',
          backgroundColor: '#FFFFFF',
          fontSize: 15,
          color: '#2E241B',
        }}
      />
    </View>
  )
}

function SectionToggle({
  title, subtitle, on, onPress,
}: { title: string; subtitle: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: on ? '#F2A24B' : '#EFE4D5',
        backgroundColor: on ? '#FFF3E5' : '#FFFFFF',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#2E241B' }}>{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: '#7B746C' }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: on ? '#F2A24B' : '#CFC2AE',
          backgroundColor: on ? '#F2A24B' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {on ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  )
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: active ? '#F2A24B' : '#EFE4D5',
        backgroundColor: active ? '#FFF3E5' : '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#8E4B14' : '#2F2D2B' }}>{label}</Text>
    </Pressable>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  fallback: { flex: 1, backgroundColor: '#F7F4EE', alignItems: 'center', justifyContent: 'center', padding: 24 } as const,
  fallbackBtn: {
    marginTop: 18, minHeight: 48, paddingHorizontal: 22, borderRadius: 999,
    backgroundColor: '#F2A24B', alignItems: 'center', justifyContent: 'center',
  } as const,
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  } as const,
  recipientPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 999, backgroundColor: '#FFF8EC',
    borderWidth: 1, borderColor: '#F0DEC1',
    alignSelf: 'flex-start',
  } as const,
  sectionBody: {
    marginTop: 12, padding: 14, borderRadius: 16,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EFE4D5',
  } as const,
  sectionLabel: { marginTop: 22, fontSize: 12, fontWeight: '700', color: '#8E4B14', letterSpacing: 1 } as const,
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EADBCB', backgroundColor: '#FFFFFF',
  } as const,
  photoBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '700', color: '#8E4B14' } as const,
  removePhotoBtn: {
    marginTop: 8, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FBE4E1',
  } as const,
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 22,
    backgroundColor: '#F7F4EE',
    borderTopWidth: 1, borderTopColor: '#EFE4D5',
  } as const,
  primaryBtn: {
    minHeight: 56, borderRadius: 999, backgroundColor: '#F2A24B',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  } as const,
  primaryBtnText: { marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#2E2C2A' } as const,
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' } as const,
  modalSheet: {
    backgroundColor: '#FFF9F2', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28,
    maxHeight: '92%' as const,
    flexShrink: 1,
  } as const,
  lineChatBackdrop: {
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 14,
  } as const,
  lineAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#C8E6C9',
    alignItems: 'center', justifyContent: 'center',
  } as const,
  cancelBtn: {
    flex: 1, minHeight: 50, borderRadius: 18,
    borderWidth: 1, borderColor: '#EADBCB', backgroundColor: '#FFFDF8',
    alignItems: 'center', justifyContent: 'center',
  } as const,
  sendBtn: {
    flex: 2, minHeight: 50, borderRadius: 18, backgroundColor: '#1B5E20',
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  } as const,
  sendBtnText: { marginLeft: 8, fontSize: 15, fontWeight: '700', color: '#FFFFFF' } as const,
}
