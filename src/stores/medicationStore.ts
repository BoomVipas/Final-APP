/**
 * src/stores/medicationStore.ts
 * Zustand store for medication schedules and administration.
 * Uses patient_prescriptions + medication_logs against the real schema.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { MealTime, MedicationLogsInsert } from '../types/database'

export interface ScheduleItem {
  prescription_id: string
  patient_id: string
  patient_name: string
  room_number: string | null
  medicine_id: string
  medicine_name: string
  medicine_strength: string | null
  dosage_form: string | null
  dose_quantity: number
  meal_time: MealTime
  status: 'pending' | 'confirmed' | 'refused' | 'skipped'
  conflict_flag: boolean
  log_id: string | null
  notes: string | null
}

export interface ScheduleGroup {
  meal_time: MealTime
  label_th: string
  label_en: string
  emoji: string
  items: ScheduleItem[]
}

const PERIOD_META: Record<MealTime, { label_th: string; label_en: string; emoji: string; order: number }> = {
  morning: { label_th: 'เช้า', label_en: 'Morning', emoji: '🌅', order: 0 },
  noon:    { label_th: 'กลางวัน', label_en: 'Noon', emoji: '☀️', order: 1 },
  evening: { label_th: 'เย็น', label_en: 'Evening', emoji: '🌆', order: 2 },
  bedtime: { label_th: 'ก่อนนอน', label_en: 'Bedtime', emoji: '🌙', order: 3 },
}

interface MedicationState {
  scheduleGroups: ScheduleGroup[]
  pendingCount: number
  completedCount: number
  loading: boolean
  error: string | null
  fetchSchedule: (wardId: string, date: string) => Promise<void>
  confirmDose: (item: ScheduleItem, caregiverId: string) => Promise<void>
  refuseDose: (item: ScheduleItem, caregiverId: string, reason: string) => Promise<void>
  subscribeToRealtime: (wardId: string, date: string) => () => void
  clearError: () => void
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  scheduleGroups: [],
  pendingCount: 0,
  completedCount: 0,
  loading: false,
  error: null,

  fetchSchedule: async (wardId: string, date: string) => {
    set({ loading: true, error: null })
    try {
      // 1. Get all active prescriptions for patients in this ward
      const prescriptionBase = supabase
        .from('patient_prescriptions')
        .select(`
          id,
          patient_id,
          medicine_id,
          dose_quantity,
          meal_times,
          notes,
          patients!inner (
            id,
            name,
            room_number,
            ward_id,
            status
          ),
          medicines (
            id,
            name,
            strength,
            dosage_form
          )
        `)
        .eq('is_active', true)
        .eq('patients.status', 'active')
        .lte('start_date', date)

      const { data: prescriptions, error: pErr } = wardId
        ? await prescriptionBase.eq('patients.ward_id', wardId)
        : await prescriptionBase

      if (pErr) throw pErr

      // 2. Get today's medication logs for these patients
      const patientIds = [...new Set((prescriptions ?? []).map((p) => p.patient_id))]
      const dateStart = `${date}T00:00:00+00:00`
      const dateEnd   = `${date}T23:59:59+00:00`

      const { data: logs, error: lErr } = await supabase
        .from('medication_logs')
        .select('id, prescription_id, meal_time, status, conflict_flag, administered_at')
        .in('patient_id', patientIds.length ? patientIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('administered_at', dateStart)
        .lte('administered_at', dateEnd)

      if (lErr) throw lErr

      // Index logs by prescription_id + meal_time
      const logIndex = new Map<string, typeof logs[0]>()
      for (const log of logs ?? []) {
        logIndex.set(`${log.prescription_id}:${log.meal_time}`, log)
      }

      // 3. Expand each prescription into one item per meal_time
      const items: ScheduleItem[] = []
      for (const rx of prescriptions ?? []) {
        const patient = rx.patients as unknown as { id: string; name: string; room_number: string | null; ward_id: string }
        const medicine = rx.medicines as unknown as { id: string; name: string; strength: string | null; dosage_form: string | null } | null
        if (!patient || !medicine) continue

        for (const mealTime of (rx.meal_times as MealTime[])) {
          const log = logIndex.get(`${rx.id}:${mealTime}`)
          let status: ScheduleItem['status'] = 'pending'
          if (log) {
            if (log.status === 'confirmed') status = 'confirmed'
            else if (log.status === 'refused') status = 'refused'
            else if (log.status === 'skipped') status = 'skipped'
          }

          items.push({
            prescription_id: rx.id,
            patient_id: rx.patient_id,
            patient_name: patient.name,
            room_number: patient.room_number,
            medicine_id: rx.medicine_id,
            medicine_name: medicine.name,
            medicine_strength: medicine.strength,
            dosage_form: medicine.dosage_form,
            dose_quantity: rx.dose_quantity,
            meal_time: mealTime,
            status,
            conflict_flag: log?.conflict_flag ?? false,
            log_id: log?.id ?? null,
            notes: rx.notes,
          })
        }
      }

      // 4. Group by meal_time
      const groupMap = new Map<MealTime, ScheduleItem[]>()
      for (const item of items) {
        const arr = groupMap.get(item.meal_time) ?? []
        arr.push(item)
        groupMap.set(item.meal_time, arr)
      }

      const scheduleGroups: ScheduleGroup[] = (Object.keys(PERIOD_META) as MealTime[])
        .filter((mt) => groupMap.has(mt))
        .map((mt) => ({
          meal_time: mt,
          ...PERIOD_META[mt],
          items: groupMap.get(mt) ?? [],
        }))

      const pendingCount   = items.filter((i) => i.status === 'pending').length
      const completedCount = items.filter((i) => i.status === 'confirmed').length

      set({ scheduleGroups, pendingCount, completedCount, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดตารางยา'
      set({ error: message, loading: false })
    }
  },

  confirmDose: async (item: ScheduleItem, caregiverId: string) => {
    // Check for existing confirmed log in the last 60 minutes (duplicate guard)
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('medication_logs')
      .select('id')
      .eq('prescription_id', item.prescription_id)
      .eq('meal_time', item.meal_time)
      .eq('status', 'confirmed')
      .gte('administered_at', windowStart)
      .limit(1)

    const isDuplicate = (existing ?? []).length > 0

    const log: MedicationLogsInsert = {
      prescription_id: item.prescription_id,
      patient_id: item.patient_id,
      medicine_id: item.medicine_id,
      caregiver_id: caregiverId,
      meal_time: item.meal_time,
      status: 'confirmed',
      method: 'normal',
      conflict_flag: isDuplicate,
    }

    const { error } = await supabase.from('medication_logs').insert(log)
    if (error) throw error
  },

  refuseDose: async (item: ScheduleItem, caregiverId: string, reason: string) => {
    const log: MedicationLogsInsert = {
      prescription_id: item.prescription_id,
      patient_id: item.patient_id,
      medicine_id: item.medicine_id,
      caregiver_id: caregiverId,
      meal_time: item.meal_time,
      status: 'refused',
      method: 'normal',
      refusal_reason: reason,
    }
    const { error } = await supabase.from('medication_logs').insert(log)
    if (error) throw error
  },

  subscribeToRealtime: (wardId: string, date: string) => {
    const channel = supabase
      .channel(`medication_logs_ward_${wardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medication_logs' }, () => {
        get().fetchSchedule(wardId, date)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },

  clearError: () => set({ error: null }),
}))