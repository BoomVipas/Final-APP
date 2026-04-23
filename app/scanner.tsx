/**
 * app/scanner.tsx
 * Drug label scanner — camera → GPT-4o vision → review → save to medicines table.
 *
 * Workflow:
 *   1. Camera with frame guide
 *   2. Capture photo (base64)
 *   3. Send to OpenAI GPT-4o vision → structured MedScanResult
 *   4. Review + edit form (pre-filled by AI)
 *   5. Save to `medicines` table (upserts by name); shows duplicate notice if exists
 */

import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../src/components/ui/Button'
import { analyzeMedicationLabel, type MedScanResult } from '../src/lib/openai'
import { supabase } from '../src/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DosageForm =
  | 'tablet' | 'capsule' | 'liquid' | 'injection'
  | 'patch' | 'inhaler' | 'drops' | 'cream' | 'suppository' | 'powder'

const FORM_OPTIONS: { value: DosageForm; label: string; emoji: string }[] = [
  { value: 'tablet',      label: 'Tablet',      emoji: '💊' },
  { value: 'capsule',     label: 'Capsule',     emoji: '💊' },
  { value: 'liquid',      label: 'Liquid',      emoji: '🧴' },
  { value: 'injection',   label: 'Injection',   emoji: '💉' },
  { value: 'patch',       label: 'Patch',       emoji: '🩹' },
  { value: 'inhaler',     label: 'Inhaler',     emoji: '🌬️' },
  { value: 'drops',       label: 'Drops',       emoji: '💧' },
  { value: 'cream',       label: 'Cream',       emoji: '🧴' },
  { value: 'suppository', label: 'Suppository', emoji: '⬛' },
  { value: 'powder',      label: 'Powder',      emoji: '🫙' },
]

interface ReviewForm {
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

const EMPTY_FORM: ReviewForm = {
  name_th: '', name_en: '', strength: '', unit: '',
  dosage_form: '', frequency: '', quantity: '', hospital: '', confidence: 1,
}

type ScreenState = 'camera' | 'analyzing' | 'review' | 'success'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric'
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        className="bg-white border border-gray-200 rounded-xl px-3 min-h-[48px] text-sm text-gray-800"
      />
    </View>
  )
}

function FormDropdown({
  label, value, onSelect,
}: {
  label: string
  value: string
  onSelect: (v: DosageForm) => void
}) {
  const [open, setOpen] = useState(false)
  const current = FORM_OPTIONS.find((o) => o.value === value)

  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="bg-white border border-gray-200 rounded-xl px-3 min-h-[48px] flex-row items-center justify-between"
      >
        <Text className={`text-sm ${current ? 'text-gray-800' : 'text-gray-400'}`}>
          {current ? `${current.emoji}  ${current.label}` : 'Select medication form'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {open && (
        <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden">
          {FORM_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); setOpen(false) }}
              className="px-3 min-h-[44px] justify-center border-b border-gray-50 flex-row items-center"
            >
              <Text className="mr-2">{opt.emoji}</Text>
              <Text className={`text-sm ${value === opt.value ? 'text-orange-500 font-semibold' : 'text-gray-700'}`}>
                {opt.label}
              </Text>
              {value === opt.value && (
                <Ionicons name="checkmark" size={14} color="#E8721A" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  const [screenState, setScreenState]   = useState<ScreenState>('camera')
  const [form, setForm]                 = useState<ReviewForm>(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [savedMedId, setSavedMedId]     = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [isDuplicate, setIsDuplicate]   = useState(false)

  const updateField = (field: keyof ReviewForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // ── Step 1: capture → analyze ─────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return
    setAnalyzeError(null)
    setScreenState('analyzing')

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true })
      if (!photo?.base64) throw new Error('No image data captured')

      const result: MedScanResult = await analyzeMedicationLabel(photo.base64)

      setForm({
        name_th:     result.name_th     ?? '',
        name_en:     result.name_en     ?? '',
        strength:    result.strength    ?? '',
        unit:        result.unit        ?? '',
        dosage_form: result.dosage_form ?? '',
        frequency:   result.frequency   ?? '',
        quantity:    result.quantity    ?? '',
        hospital:    result.hospital    ?? '',
        confidence:  typeof result.confidence === 'number' ? result.confidence : 1,
      })
      setScreenState('review')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setAnalyzeError(msg)
      setScreenState('camera')
      Alert.alert('Analysis failed', `${msg}\n\nMake sure the label is well-lit and inside the frame.`)
    }
  }

  const handleRetake = () => {
    setForm(EMPTY_FORM)
    setAnalyzeError(null)
    setScreenState('camera')
  }

  // ── Step 2: save to medicines table ───────────────────────────────────────
  const handleSave = async () => {
    const nameEn = form.name_en.trim()
    const nameTh = form.name_th.trim()

    if (!nameEn && !nameTh) {
      Alert.alert('Missing name', 'Please enter at least the medication name before saving.')
      return
    }

    setSaving(true)
    try {
      // Combined name: "ชื่อภาษาไทย / English Name" or whichever is available
      const combinedName = nameTh && nameEn
        ? `${nameTh} / ${nameEn}`
        : nameTh || nameEn

      const strength = form.unit
        ? `${form.strength} ${form.unit}`.trim()
        : form.strength

      // Check for existing medicine with the same English name
      const { data: existing } = await supabase
        .from('medicines')
        .select('id, name')
        .ilike('name', `%${nameEn}%`)
        .limit(1)
        .maybeSingle()

      if (existing) {
        setIsDuplicate(true)
        setSavedMedId(existing.id)
        setScreenState('success')
        setSaving(false)
        return
      }

      // Insert new medicine
      const { data: inserted, error } = await supabase
        .from('medicines')
        .insert({
          name:         combinedName,
          dosage_form:  form.dosage_form || null,
          strength:     strength || null,
          description:  [
            form.frequency   ? `Frequency: ${form.frequency}`   : null,
            form.quantity    ? `Quantity: ${form.quantity}`      : null,
            form.hospital    ? `Issued by: ${form.hospital}`     : null,
          ].filter(Boolean).join(' | ') || null,
        })
        .select('id')
        .single()

      if (error) throw error

      setIsDuplicate(false)
      setSavedMedId(inserted?.id ?? null)
      setScreenState('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      Alert.alert('Save failed', msg)
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Permission states
  // ─────────────────────────────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#E8721A" />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-5xl mb-5">📷</Text>
        <Text className="text-lg font-bold text-gray-900 text-center mb-2">Camera Access Required</Text>
        <Text className="text-sm text-gray-500 text-center mb-8">
          PILLo needs camera access to scan medication labels.
        </Text>
        <Button title="Allow Camera Access" onPress={requestPermission} variant="primary" />
        <TouchableOpacity onPress={() => router.back()} className="mt-4 min-h-[48px] items-center justify-center">
          <Text className="text-sm text-gray-400">Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera view
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          {/* Top bar */}
          <View className="flex-row items-center px-4 pt-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white font-semibold text-base ml-3">Scan Medication Label</Text>
          </View>

          {/* Dimmed overlay with transparent frame hole */}
          <View className="flex-1 items-center justify-center">
            <View style={{ alignItems: 'center' }}>
              {/* Top dim */}
              <View style={{ width: '100%', height: 40, backgroundColor: 'rgba(0,0,0,0.45)' }} />
              <View style={{ flexDirection: 'row' }}>
                {/* Left dim */}
                <View style={{ width: 40, height: 190, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                {/* Frame */}
                <View
                  style={{
                    width: 300,
                    height: 190,
                    borderWidth: 2.5,
                    borderColor: '#E8721A',
                    borderRadius: 14,
                  }}
                >
                  {/* Corner accents */}
                  {[
                    { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
                    { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
                    { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
                    { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
                  ].map((style, i) => (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        width: 22, height: 22,
                        borderColor: '#E8721A',
                        ...style,
                      }}
                    />
                  ))}
                </View>
                {/* Right dim */}
                <View style={{ width: 40, height: 190, backgroundColor: 'rgba(0,0,0,0.45)' }} />
              </View>
              {/* Bottom dim */}
              <View style={{ width: '100%', height: 40, backgroundColor: 'rgba(0,0,0,0.45)' }} />
            </View>

            <Text className="text-white/80 text-xs mt-4 text-center px-8">
              Align the medication label inside the orange frame
            </Text>
            {analyzeError && (
              <View className="bg-red-500/80 rounded-xl px-4 py-2 mt-3 mx-8">
                <Text className="text-white text-xs text-center">Previous scan failed — please try again</Text>
              </View>
            )}
          </View>

          {/* Bottom: capture button */}
          <View className="items-center pb-12">
            <TouchableOpacity
              onPress={handleCapture}
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: '#E8721A',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: 'rgba(255,255,255,0.7)',
              }}
            >
              <Ionicons name="camera" size={30} color="white" />
            </TouchableOpacity>
            <Text className="text-white/60 text-xs mt-3">Tap to capture</Text>
          </View>
        </CameraView>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Analyzing
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'analyzing') {
    return (
      <SafeAreaView className="flex-1 bg-[#FFF9F1] items-center justify-center px-8">
        <View className="w-20 h-20 rounded-[24px] bg-[#FFF0E0] items-center justify-center mb-6">
          <ActivityIndicator size="large" color="#E8721A" />
        </View>
        <Text className="text-xl font-bold text-gray-900 text-center mb-2">Reading Label...</Text>
        <Text className="text-sm text-gray-500 text-center leading-5">
          AI is analyzing the medication label.{'\n'}This usually takes 3–5 seconds.
        </Text>

        {/* Progress steps */}
        <View className="mt-10 w-full">
          {[
            { icon: '📸', text: 'Photo captured' },
            { icon: '🤖', text: 'Sending to GPT-4o Vision' },
            { icon: '📋', text: 'Extracting medication details' },
          ].map((step, i) => (
            <View key={i} className="flex-row items-center mb-3">
              <Text className="text-lg mr-3">{step.icon}</Text>
              <Text className="text-sm text-gray-600">{step.text}</Text>
              {i < 1 && <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={{ marginLeft: 'auto' }} />}
              {i === 1 && <ActivityIndicator size="small" color="#E8721A" style={{ marginLeft: 'auto' }} />}
            </View>
          ))}
        </View>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Success screen
  // ─────────────────────────────────────────────────────────────────────────

  if (screenState === 'success') {
    const displayName = [form.name_th, form.name_en].filter(Boolean).join(' / ') || 'Medicine'
    return (
      <SafeAreaView className="flex-1 bg-[#FFF9F1] items-center justify-center px-8">
        <View className={`w-20 h-20 rounded-[24px] items-center justify-center mb-6 ${isDuplicate ? 'bg-blue-50' : 'bg-green-50'}`}>
          <Text className="text-4xl">{isDuplicate ? 'ℹ️' : '✅'}</Text>
        </View>

        <Text className="text-xl font-bold text-gray-900 text-center mb-2">
          {isDuplicate ? 'Already in Database' : 'Saved Successfully'}
        </Text>
        <Text className="text-sm text-gray-500 text-center mb-1">{displayName}</Text>
        {form.strength ? (
          <Text className="text-xs text-gray-400 text-center mb-6">
            {form.strength} {form.unit} · {form.dosage_form}
          </Text>
        ) : null}

        {isDuplicate && (
          <View className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 w-full">
            <Text className="text-sm text-blue-700 text-center">
              This medication is already recorded in the system. No duplicate was created.
            </Text>
          </View>
        )}

        <Button
          title="Scan Another Label"
          onPress={() => {
            setForm(EMPTY_FORM)
            setSavedMedId(null)
            setIsDuplicate(false)
            setScreenState('camera')
          }}
          variant="primary"
          className="w-full mb-3"
        />
        <Button
          title="Back to Home"
          onPress={() => router.back()}
          variant="secondary"
          className="w-full"
        />
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#F8F7F5]">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View className="flex-row items-center px-4 pt-4 pb-3 bg-white border-b border-gray-100">
          <TouchableOpacity onPress={handleRetake} className="w-10 h-10 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color="#4B5563" />
          </TouchableOpacity>
          <View className="flex-1 ml-2">
            <Text className="text-base font-bold text-gray-900">Review Information</Text>
            <Text className="text-xs text-gray-400">Edit any fields the AI may have missed</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Confidence banner */}
          {form.confidence < 0.85 && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex-row items-start">
              <Text className="text-lg mr-2">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-amber-800">Low confidence ({Math.round(form.confidence * 100)}%)</Text>
                <Text className="text-xs text-amber-700 mt-0.5">
                  The label may have been partially obscured. Please review every field carefully before saving.
                </Text>
              </View>
            </View>
          )}

          {form.confidence >= 0.85 && (
            <View className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4 flex-row items-center">
              <Text className="text-lg mr-2">✅</Text>
              <Text className="text-sm text-green-700 font-medium">
                High confidence ({Math.round(form.confidence * 100)}%) — looks good!
              </Text>
            </View>
          )}

          {/* Medication names */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-1">Medication Name</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <FormField
              label="Thai Name (ชื่อภาษาไทย)"
              value={form.name_th}
              onChangeText={(v) => updateField('name_th', v)}
              placeholder="e.g. อะม็อกซีซิลลิน"
            />
            <FormField
              label="English / Generic Name"
              value={form.name_en}
              onChangeText={(v) => updateField('name_en', v)}
              placeholder="e.g. Amoxicillin"
            />
          </View>

          {/* Dosage */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dosage</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField
                  label="Strength"
                  value={form.strength}
                  onChangeText={(v) => updateField('strength', v)}
                  placeholder="500"
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <FormField
                  label="Unit"
                  value={form.unit}
                  onChangeText={(v) => updateField('unit', v)}
                  placeholder="mg"
                />
              </View>
            </View>
            <FormDropdown
              label="Medication Form"
              value={form.dosage_form}
              onSelect={(v) => setForm((prev) => ({ ...prev, dosage_form: v }))}
            />
          </View>

          {/* Instructions */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Instructions</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <FormField
              label="Frequency"
              value={form.frequency}
              onChangeText={(v) => updateField('frequency', v)}
              placeholder="e.g. 3 times daily after meals"
            />
            <FormField
              label="Total Quantity"
              value={form.quantity}
              onChangeText={(v) => updateField('quantity', v)}
              placeholder="e.g. 30 tablets"
              keyboardType="numeric"
            />
          </View>

          {/* Source */}
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Source</Text>
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <FormField
              label="Hospital / Pharmacy"
              value={form.hospital}
              onChangeText={(v) => updateField('hospital', v)}
              placeholder="e.g. Saensuk Healthcare Center"
            />
          </View>

          <Button
            title={saving ? 'Saving...' : 'Save to Database'}
            onPress={handleSave}
            variant="primary"
            loading={saving}
            disabled={saving}
          />
          <TouchableOpacity
            onPress={handleRetake}
            className="items-center justify-center min-h-[48px] mt-2"
          >
            <Text className="text-sm text-gray-400">Retake Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
