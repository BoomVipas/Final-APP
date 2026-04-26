/**
 * src/stores/handoverStore.ts
 * Zustand store for shift handover state.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { ShiftHandoversRow } from '../types/database'

interface HandoverState {
  pending: ShiftHandoversRow | null
  history: ShiftHandoversRow[]
  loading: boolean
  error: string | null
  fetchPending: (wardId: string) => Promise<void>
  fetchHistory: (wardId: string) => Promise<void>
  acknowledge: (
    handoverId: string,
    payload: {
      acknowledged_by_id: string
      shift_notes: string | null
      deferred_item_keys: string[]
    },
  ) => Promise<void>
  startHandover: (input: {
    wardId: string
    caregiverId: string
    shiftStart: string
    shiftEnd: string
    summaryJson?: Record<string, unknown>
  }) => Promise<ShiftHandoversRow | null>
  setPending: (handover: ShiftHandoversRow | null) => void
  setHistory: (rows: ShiftHandoversRow[]) => void
  clearError: () => void
}

export const useHandoverStore = create<HandoverState>((set, get) => ({
  pending: null,
  history: [],
  loading: false,
  error: null,

  fetchPending: async (wardId: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('shift_handovers')
        .select('*')
        .eq('ward_id', wardId)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      set({ pending: (data as ShiftHandoversRow | null) ?? null, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchHistory: async (wardId: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('shift_handovers')
        .select('*')
        .eq('ward_id', wardId)
        .not('acknowledged_at', 'is', null)
        .order('shift_end', { ascending: false })
        .limit(50)
      if (error) throw error
      set({ history: (data ?? []) as ShiftHandoversRow[], loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  acknowledge: async (handoverId, payload) => {
    set({ loading: true, error: null })
    try {
      const current = get().pending
      const updatedSummary: Record<string, unknown> = {
        ...((current?.summary_json as Record<string, unknown>) ?? {}),
        deferred_item_keys: payload.deferred_item_keys,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { error } = await sb
        .from('shift_handovers')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by_id: payload.acknowledged_by_id,
          shift_notes: payload.shift_notes,
          summary_json: updatedSummary,
        })
        .eq('id', handoverId)
      if (error) throw error
      set({ pending: null, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      throw err
    }
  },

  startHandover: async ({ wardId, caregiverId, shiftStart, shiftEnd, summaryJson }) => {
    set({ loading: true, error: null })
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data, error } = await sb
        .from('shift_handovers')
        .insert({
          ward_id: wardId,
          caregiver_id: caregiverId,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          summary_json: summaryJson ?? {},
        })
        .select('*')
        .single()
      if (error) throw error
      const row = data as ShiftHandoversRow
      set({ pending: row, loading: false })
      return row
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
      return null
    }
  },

  setPending: (handover) => set({ pending: handover }),
  setHistory: (rows) => set({ history: rows }),
  clearError: () => set({ error: null }),
}))
