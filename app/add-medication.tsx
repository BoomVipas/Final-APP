/**
 * app/add-medication.tsx
 * Add a new active prescription for a patient.
 * Inserts a row into `patient_prescriptions` (or simulates it in mock mode).
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { supabase } from '../src/lib/supabase'
import { Button } from '../src/components/ui/Button'
import { MOCK_MEDICINES, USE_MOCK } from '../src/mocks'
import type { MealTime, MedicinesRow } from '../src/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_TIME_OPTIONS: Array<{
  value: MealTime
  emoji: string
  label_th: string
  label_en: string
}> = [
  { value: 'morning', emoji: '🌅', label_th: 'เช้า', label_en: 'Morning' },
  { value: 'noon', emoji: '☀️', label_th: 'กลางวัน', label_en: 'Noon' },
  { value: 'evening', emoji: '🌆', label_th: 'เย็น', label_en: 'Evening' },
  { value: 'bedtime', emoji: '🌙', label_th: 'ก่อนนอน', label_en: 'Bedtime' },
]

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function AddMedicationScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ patientId?: string; patientName?: string }>()

  const patientId = typeof params.patientId === 'string' ? params.patientId : ''
  const patientName =
    typeof params.patientName === 'string' && params.patientName.length > 0
      ? params.patientName
      : 'Patient'

  // Form state
  const [medicines, setMedicines] = useState<MedicinesRow[]>([])
  const [medicinesLoading, setMedicinesLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedMedicine, setSelectedMedicine] = useState<MedicinesRow | null>(null)
  const [doseQuantity, setDoseQuantity] = useState(1)
  const [mealTimes, setMealTimes] = useState<MealTime[]>([])
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Load medicines list ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true

    ;(async () => {
      if (USE_MOCK) {
        if (active) {
          setMedicines(MOCK_MEDICINES)
          setMedicinesLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('medicines')
        .select(
          'id, name, category, dosage_form, strength, description, side_effects, storage_instructions, created_at',
        )
        .order('name', { ascending: true })

      if (!active) return

      if (error) {
        // Fall back to mock list so the form is still usable when offline.
        setMedicines(MOCK_MEDICINES)
      } else {
        setMedicines((data as MedicinesRow[] | null) ?? [])
      }
      setMedicinesLoading(false)
    })()

    return () => {
      active = false
    }
  }, [])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicines.slice(0, 10)
    return medicines
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [medicines, search])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleMealTime = (value: MealTime) => {
    setMealTimes((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    )
  }

  const decrementDose = () => setDoseQuantity((q) => Math.max(1, q - 1))
  const incrementDose = () => setDoseQuantity((q) => Math.min(99, q + 1))

  const isValid =
    Boolean(selectedMedicine) &&
    mealTimes.length > 0 &&
    ISO_DATE_RE.test(startDate) &&
    (endDate === '' || ISO_DATE_RE.test(endDate))

  const handleSave = async () => {
    if (!patientId) {
      Alert.alert('Missing patient', 'Cannot save without a patient context.')
      return
    }
    if (!selectedMedicine) {
      Alert.alert('Missing medicine', 'Please select a medicine to continue.')
      return
    }
    if (mealTimes.length === 0) {
      Alert.alert('Missing meal times', 'Please choose at least one meal time.')
      return
    }
    if (!ISO_DATE_RE.test(startDate)) {
      Alert.alert('Invalid start date', 'Please enter a date as YYYY-MM-DD.')
      return
    }
    if (endDate !== '' && !ISO_DATE_RE.test(endDate)) {
      Alert.alert('Invalid end date', 'End date must be YYYY-MM-DD or left blank.')
      return
    }

    setSaving(true)

    try {
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 600))
      } else {
        const { error } = await supabase.from('patient_prescriptions').insert({
          patient_id: patientId,
          medicine_id: selectedMedicine.id,
          dose_quantity: doseQuantity,
          meal_times: mealTimes,
          start_date: startDate,
          end_date: endDate === '' ? null : endDate,
          is_active: true,
          notes: notes.trim() === '' ? null : notes.trim(),
        })
        if (error) throw error
      }

      Alert.alert(
        'บันทึกสำเร็จ / Saved',
        `${selectedMedicine.name} added for ${patientName}.`,
        [{ text: 'OK', onPress: () => router.back() }],
      )
    } catch (error) {
      Alert.alert(
        'Unable to save',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <LinearGradient
            colors={['#FFF7ED', '#FDD8AB', '#F6A84C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
            </Pressable>

            <Text style={styles.heroTitle}>Add Medication</Text>
            <Text style={styles.heroSubtitle}>
              เพิ่มรายการยาใหม่ให้ผู้ป่วย
            </Text>

            <View style={styles.patientChip}>
              <Ionicons name="person-circle-outline" size={20} color="#8E4B14" />
              <Text style={styles.patientChipLabel}>for </Text>
              <Text style={styles.patientChipName} numberOfLines={1}>
                {patientName}
              </Text>
            </View>
          </LinearGradient>

          {/* ── Medicine picker card ─────────────────────────────────────── */}
          <View style={[styles.card, styles.cardShadow]}>
            <Text style={styles.sectionTitle}>Medicine</Text>
            <Text style={styles.sectionHint}>เลือกยาจากคลัง</Text>

            {selectedMedicine ? (
              <View style={styles.selectedMedCard}>
                <View style={styles.selectedMedIcon}>
                  <Ionicons name="medkit" size={22} color="#C96B1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedMedName} numberOfLines={2}>
                    {selectedMedicine.name}
                  </Text>
                  <Text style={styles.selectedMedMeta}>
                    {[selectedMedicine.strength, selectedMedicine.dosage_form, selectedMedicine.category]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setSelectedMedicine(null)
                    setSearch('')
                  }}
                  style={styles.selectedMedClear}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color="#8E4B14" />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchWrap}>
                  <Ionicons name="search" size={18} color="#9A8B78" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name (Thai or English)"
                    placeholderTextColor="#A9A097"
                    style={styles.searchInput}
                    autoCorrect={false}
                  />
                </View>

                {medicinesLoading ? (
                  <View style={styles.medListLoading}>
                    <ActivityIndicator size="small" color="#C96B1A" />
                  </View>
                ) : filteredMedicines.length === 0 ? (
                  <View style={styles.medListEmpty}>
                    <Text style={styles.medListEmptyText}>
                      No medicines match your search.
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    {filteredMedicines.map((med) => (
                      <Pressable
                        key={med.id}
                        onPress={() => {
                          setSelectedMedicine(med)
                          setSearch('')
                        }}
                        style={({ pressed }) => [
                          styles.medOption,
                          pressed && styles.medOptionPressed,
                        ]}
                      >
                        <View style={styles.medOptionInner}>
                          <Text style={styles.medOptionName} numberOfLines={1}>
                            {med.name}
                          </Text>
                          <Text style={styles.medOptionMeta} numberOfLines={1}>
                            {[med.strength, med.dosage_form].filter(Boolean).join(' · ') || '—'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#B59B7E" />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Dose card ─────────────────────────────────────────────────── */}
          <View style={[styles.card, styles.cardShadow]}>
            <Text style={styles.sectionTitle}>Dose per intake</Text>
            <Text style={styles.sectionHint}>จำนวนเม็ดต่อมื้อ</Text>

            <View style={styles.stepperRow}>
              <Pressable
                onPress={decrementDose}
                disabled={doseQuantity <= 1}
                style={[
                  styles.stepperButton,
                  doseQuantity <= 1 && styles.stepperButtonDisabled,
                ]}
                hitSlop={6}
              >
                <Ionicons name="remove" size={24} color="#8E4B14" />
              </Pressable>

              <View style={styles.stepperValueWrap}>
                <Text style={styles.stepperValue}>{doseQuantity}</Text>
                <Text style={styles.stepperUnit}>tablet{doseQuantity === 1 ? '' : 's'}</Text>
              </View>

              <Pressable
                onPress={incrementDose}
                disabled={doseQuantity >= 99}
                style={[
                  styles.stepperButton,
                  doseQuantity >= 99 && styles.stepperButtonDisabled,
                ]}
                hitSlop={6}
              >
                <Ionicons name="add" size={24} color="#8E4B14" />
              </Pressable>
            </View>
          </View>

          {/* ── Meal times card ───────────────────────────────────────────── */}
          <View style={[styles.card, styles.cardShadow]}>
            <Text style={styles.sectionTitle}>Meal times</Text>
            <Text style={styles.sectionHint}>เลือกอย่างน้อย 1 มื้อ</Text>

            <View style={styles.chipsRow}>
              {MEAL_TIME_OPTIONS.map((opt) => {
                const active = mealTimes.includes(opt.value)
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => toggleMealTime(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.chipLabelTh, active && styles.chipLabelActive]}>
                      {opt.label_th}
                    </Text>
                    <Text style={[styles.chipLabelEn, active && styles.chipLabelEnActive]}>
                      {opt.label_en}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* ── Dates card ────────────────────────────────────────────────── */}
          <View style={[styles.card, styles.cardShadow]}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <Text style={styles.sectionHint}>วันที่เริ่ม / สิ้นสุด</Text>

            <Text style={styles.label}>Start date</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A9A097"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>End date (optional)</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="leave blank for ongoing"
              placeholderTextColor="#A9A097"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* ── Notes card ────────────────────────────────────────────────── */}
          <View style={[styles.card, styles.cardShadow]}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionHint}>หมายเหตุ (ไม่บังคับ)</Text>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Take with food, monitor blood pressure"
              placeholderTextColor="#A9A097"
              style={[styles.input, styles.notesInput]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          <View style={styles.ctaWrap}>
            <Button
              title={saving ? 'กำลังบันทึก... / Saving...' : 'บันทึก / Save'}
              onPress={handleSave}
              disabled={!isValid}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
  content: {
    paddingBottom: 48,
  },

  // Hero
  hero: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 36,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: '#5D554D',
  },
  patientChip: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#FFE6CC',
    maxWidth: '100%',
  },
  patientChipLabel: {
    fontSize: 14,
    color: '#8E4B14',
    fontWeight: '500',
  },
  patientChipName: {
    fontSize: 14,
    color: '#8E4B14',
    fontWeight: '700',
    flexShrink: 1,
  },

  // Generic card
  card: {
    marginTop: 16,
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  cardShadow: {
    shadowColor: '#8A6440',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  sectionHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#9A8B78',
    marginBottom: 12,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#4B4743',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EADFD2',
    backgroundColor: '#FCFAF6',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#2F2D2B',
    marginBottom: 14,
  },
  notesInput: {
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 0,
  },

  // Medicine search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EADFD2',
    backgroundColor: '#FCFAF6',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2F2D2B',
    paddingVertical: 0,
  },
  medListLoading: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medListEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  medListEmptyText: {
    fontSize: 14,
    color: '#9A8B78',
  },
  medOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 48,
  },
  medOptionPressed: {
    backgroundColor: '#FFF4E8',
  },
  medOptionInner: {
    flex: 1,
    paddingRight: 8,
  },
  medOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2F2D2B',
  },
  medOptionMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#9A8B78',
  },

  // Selected medicine card
  selectedMedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: '#FFE6CC',
  },
  selectedMedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE6CC',
  },
  selectedMedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  selectedMedMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#8E4B14',
  },
  selectedMedClear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: '#FFE6CC',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  stepperUnit: {
    marginTop: 2,
    fontSize: 13,
    color: '#9A8B78',
  },

  // Meal-time chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    minWidth: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EADFD2',
    backgroundColor: '#FCFAF6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  chipActive: {
    borderColor: '#C96B1A',
    backgroundColor: '#FFE6CC',
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabelTh: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B4743',
  },
  chipLabelActive: {
    color: '#8E4B14',
  },
  chipLabelEn: {
    fontSize: 12,
    color: '#9A8B78',
  },
  chipLabelEnActive: {
    color: '#8E4B14',
  },

  // CTA
  ctaWrap: {
    marginTop: 22,
    marginHorizontal: 18,
  },
})
