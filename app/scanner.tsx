/**
 * app/scanner.tsx
 * Drug label scanner using expo-camera + review form.
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
import { Button } from '../src/components/ui/Button'
import { Card } from '../src/components/ui/Card'

type MedForm = 'tablet' | 'capsule' | 'liquid' | 'injection' | 'patch' | 'inhaler' | 'drops' | 'cream' | 'suppository' | 'powder'

const FORM_OPTIONS: { value: MedForm; label: string }[] = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'patch', label: 'Patch' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
  { value: 'cream', label: 'Cream' },
  { value: 'suppository', label: 'Suppository' },
  { value: 'powder', label: 'Powder' },
]

interface ScannedData {
  name_th: string
  name_en: string
  dosage: string
  unit: string
  form: MedForm | ''
  frequency: string
  quantity: string
  hospital: string
  confidence: number
}

const EMPTY_FORM: ScannedData = {
  name_th: '',
  name_en: '',
  dosage: '',
  unit: '',
  form: '',
  frequency: '',
  quantity: '',
  hospital: '',
  confidence: 1,
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric'
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-600 mb-1">{label}</Text>
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
  label,
  value,
  onSelect,
}: {
  label: string
  value: string
  onSelect: (val: MedForm) => void
}) {
  const [open, setOpen] = useState(false)
  const current = FORM_OPTIONS.find((o) => o.value === value)

  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-600 mb-1">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="bg-white border border-gray-200 rounded-xl px-3 min-h-[48px] flex-row items-center justify-between"
      >
        <Text className={`text-sm ${current ? 'text-gray-800' : 'text-gray-400'}`}>
          {current ? current.label : 'Select medication form'}
        </Text>
        <Text className="text-gray-400">▾</Text>
      </TouchableOpacity>
      {open && (
        <View className="bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden">
          {FORM_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { onSelect(opt.value); setOpen(false) }}
              className="px-3 min-h-[44px] justify-center border-b border-gray-50"
            >
              <Text className={`text-sm ${value === opt.value ? 'text-orange-500 font-semibold' : 'text-gray-700'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

type ScreenState = 'camera' | 'analyzing' | 'review'

export default function ScannerScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  const [screenState, setScreenState] = useState<ScreenState>('camera')
  const [formData, setFormData] = useState<ScannedData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const handleCapture = async () => {
    if (!cameraRef.current) return
    try {
      setScreenState('analyzing')
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true })

      // Simulate analysis — in production this calls the label-scanner Edge Function
      await new Promise((r) => setTimeout(r, 1500))

      // Mock result with low-confidence flag for demo
      setFormData({
        name_th: 'อะม็อกซีซิลลิน',
        name_en: 'Amoxicillin',
        dosage: '500',
        unit: 'mg',
        form: 'capsule',
        frequency: '3 times daily',
        quantity: '30',
        hospital: 'Central Hospital',
        confidence: 0.82,
      })

      setScreenState('review')
    } catch (err) {
      setScreenState('camera')
      Alert.alert('Capture failed', 'Unable to take the photo. Please try again.')
    }
  }

  const handleRetake = () => {
    setFormData(EMPTY_FORM)
    setScreenState('camera')
  }

  const handleSave = async () => {
    if (!formData.name_en.trim() && !formData.name_th.trim()) {
      Alert.alert('Missing medication name', 'Please enter at least one medication name before saving.')
      return
    }
    setSaving(true)
    try {
      // In production: create prescription via Supabase
      await new Promise((r) => setTimeout(r, 800))
      Alert.alert('Saved', 'Medication information has been added.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Save failed', 'Unable to save the medication information.')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof ScannedData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Permission not yet determined
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator color="#E8721A" />
      </SafeAreaView>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-4xl mb-4">📷</Text>
        <Text className="text-base font-bold text-gray-900 text-center mb-2">
          Camera Permission Required
        </Text>
        <Text className="text-sm text-gray-500 text-center mb-6">
          The app needs camera access to scan medication labels.
        </Text>
        <Button title="Allow Camera Access" onPress={requestPermission} variant="primary" />
      </SafeAreaView>
    )
  }

  // Camera view
  if (screenState === 'camera') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          {/* Frame guide overlay */}
          <View className="flex-1 items-center" style={{ paddingTop: 260 }}>
            <View
              style={{
                width: 280,
                height: 180,
                borderWidth: 2,
                borderColor: '#E8721A',
                borderRadius: 12,
                backgroundColor: 'transparent',
              }}
            />
            <Text className="text-white text-xs mt-3 text-center px-8">
              Place the medication label inside the frame, then take a photo.
            </Text>
          </View>

          {/* Capture button */}
          <View className="items-center pb-10">
            <TouchableOpacity
              onPress={handleCapture}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: '#E8721A',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: 'white',
              }}
            >
              <Text className="text-white text-sm font-bold">Capture</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    )
  }

  // Analyzing state
  if (screenState === 'analyzing') {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <ActivityIndicator size="large" color="#E8721A" />
        <Text className="text-base font-semibold text-gray-800 mt-4">Analyzing...</Text>
        <Text className="text-sm text-gray-500 mt-1 text-center">
          AI is reading the medication label. Please wait.
        </Text>
      </SafeAreaView>
    )
  }

  // Review form
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Low confidence warning */}
          {formData.confidence < 0.85 && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex-row items-start">
              <Text className="text-lg mr-2">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-yellow-800">Low confidence</Text>
                <Text className="text-xs text-yellow-700 mt-0.5">
                  ({Math.round(formData.confidence * 100)}%) Please review the information before saving.
                </Text>
              </View>
            </View>
          )}

          <Text className="text-base font-bold text-gray-900 mb-3">Review Information</Text>

          <FormField
            label="Medication Name (Thai)"
            value={formData.name_th}
            onChangeText={(v) => updateField('name_th', v)}
            placeholder="e.g. อะม็อกซีซิลลิน"
          />
          <FormField
            label="Medication Name (English)"
            value={formData.name_en}
            onChangeText={(v) => updateField('name_en', v)}
            placeholder="e.g. Amoxicillin"
          />

          <View className="flex-row gap-2 mb-0">
            <View className="flex-1">
              <FormField
                label="Dosage"
                value={formData.dosage}
                onChangeText={(v) => updateField('dosage', v)}
                placeholder="e.g. 500"
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Unit"
                value={formData.unit}
                onChangeText={(v) => updateField('unit', v)}
                placeholder="e.g. mg"
              />
            </View>
          </View>

          <FormDropdown
            label="Medication Form"
            value={formData.form}
            onSelect={(v) => setFormData((prev) => ({ ...prev, form: v }))}
          />

          <FormField
            label="Frequency"
            value={formData.frequency}
            onChangeText={(v) => updateField('frequency', v)}
            placeholder="e.g. 3 times daily"
          />

          <FormField
            label="Quantity"
            value={formData.quantity}
            onChangeText={(v) => updateField('quantity', v)}
            placeholder="e.g. 30"
            keyboardType="numeric"
          />

          <FormField
            label="Hospital / Doctor"
            value={formData.hospital}
            onChangeText={(v) => updateField('hospital', v)}
            placeholder="e.g. Central Hospital"
          />

          <Button
            title="Save"
            onPress={handleSave}
            variant="primary"
            loading={saving}
            disabled={saving}
            className="mt-2"
          />
          <Button
            title="Retake"
            onPress={handleRetake}
            variant="secondary"
            className="mt-2"
          />

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
