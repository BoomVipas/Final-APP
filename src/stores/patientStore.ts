/**
 * src/stores/patientStore.ts
 * Zustand store for patient directory and detail.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { PatientsRow } from '../types/database'

interface PatientState {
  patients: PatientsRow[]
  selectedPatient: PatientsRow | null
  loading: boolean
  error: string | null
  fetchPatients: (wardId: string) => Promise<void>
  fetchPatientDetail: (patientId: string) => Promise<void>
  searchPatients: (query: string) => PatientsRow[]
  clearError: () => void
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patients: [],
  selectedPatient: null,
  loading: false,
  error: null,

  fetchPatients: async (wardId: string) => {
    set({ loading: true, error: null })
    try {
      const base = supabase
        .from('patients')
        .select('id, name, photo_url, room_number, ward_id, status, date_of_birth, notes, created_at, updated_at')
        .eq('status', 'active')
        .order('name', { ascending: true })

      const { data, error } = wardId
        ? await base.eq('ward_id', wardId)
        : await base

      if (error) throw error
      set({ patients: data ?? [], loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ป่วย'
      set({ error: message, loading: false })
    }
  },

  fetchPatientDetail: async (patientId: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, photo_url, room_number, ward_id, status, date_of_birth, notes, created_at, updated_at')
        .eq('id', patientId)
        .single()

      if (error) throw error
      set({ selectedPatient: data, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ป่วย'
      set({ error: message, loading: false })
    }
  },

  searchPatients: (query: string): PatientsRow[] => {
    const { patients } = get()
    if (!query.trim()) return patients
    const q = query.toLowerCase().trim()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.room_number ?? '').toLowerCase().includes(q),
    )
  },

  clearError: () => set({ error: null }),
}))