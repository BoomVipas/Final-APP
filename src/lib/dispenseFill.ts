/*
 * Schema note: dispense_sessions, dispense_items, cabinet_slots and dispenser_slots
 * all have type definitions in src/types/database.ts; this file uses the shared
 * supabase client (untyped — no Database generic applied in src/lib/supabase.ts)
 * and casts read results to the table Row types. Open question for the next
 * agent: confirm the live Supabase has dispenser_slots with a (session_id,
 * slot_index) unique constraint — required for upsertDispenserSlot.
 */

import { supabase } from './supabase'
import { USE_MOCK } from '../mocks'
import type { DispenseItemsRow, DispenserSlotsRow } from '../types/database'

const FILL_DAYS = 7

function todayBangkok(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

function mockId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `mock-${prefix}-${Date.now().toString(36)}-${rand}`
}

export async function createDispenseSession(
  patient_id: string,
  ward_id: string,
): Promise<{ session_id: string }> {
  if (USE_MOCK) {
    const session_id = mockId('session')
    console.log(`[dispenseFill mock] createDispenseSession patient=${patient_id} ward=${ward_id} -> ${session_id}`)
    return { session_id }
  }

  const { data, error } = await supabase
    .from('dispense_sessions')
    .insert({
      patient_id,
      ward_id,
      session_date: todayBangkok(),
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { session_id: (data as { id: string }).id }
}

export async function upsertDispenserSlot(
  session_id: string,
  slot_index: number,
  medicine_id: string,
  patient_id: string,
  dose_quantity: number,
  meal_times: string[],
): Promise<void> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] upsertDispenserSlot session=${session_id} slot=${slot_index} medicine=${medicine_id} dose=${dose_quantity} meals=${meal_times.join(',')}`)
    return
  }

  const { error } = await supabase
    .from('dispenser_slots')
    .upsert(
      {
        session_id,
        slot_index,
        medicine_id,
        patient_id,
        dose_quantity,
        meal_times,
        confirmed: false,
      },
      { onConflict: 'session_id,slot_index' },
    )
  if (error) throw new Error(error.message)
}

export async function confirmDispenserSlot(
  session_id: string,
  slot_index: number,
): Promise<void> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] confirmDispenserSlot session=${session_id} slot=${slot_index}`)
    return
  }

  const { error } = await supabase
    .from('dispenser_slots')
    .update({ confirmed: true })
    .eq('session_id', session_id)
    .eq('slot_index', slot_index)
  if (error) throw new Error(error.message)
}

export async function generateDispenseItems(session_id: string): Promise<number> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] generateDispenseItems session=${session_id} -> 0 (no slots in mock store)`)
    return 0
  }

  const { data: slotsData, error: slotsError } = await supabase
    .from('dispenser_slots')
    .select('session_id, slot_index, medicine_id, patient_id, dose_quantity, meal_times, confirmed')
    .eq('session_id', session_id)
    .eq('confirmed', true)
  if (slotsError) throw new Error(slotsError.message)

  const slots = (slotsData ?? []) as unknown as DispenserSlotsRow[]
  if (slots.length === 0) return 0

  const items = slots.flatMap((slot) =>
    Array.from({ length: FILL_DAYS }, (_, dayOffset) =>
      slot.meal_times.map((meal_time) => ({
        session_id,
        patient_id: slot.patient_id,
        medicine_id: slot.medicine_id,
        slot_index: slot.slot_index,
        meal_time,
        quantity: slot.dose_quantity,
        status: 'queued' as const,
        day_offset: dayOffset,
      })),
    ).flat(),
  )

  const { error } = await supabase.from('dispense_items').insert(items)
  if (error) throw new Error(error.message)
  return items.length
}

export async function getDispenserSlots(session_id: string): Promise<DispenserSlotsRow[]> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] getDispenserSlots session=${session_id} -> []`)
    return []
  }

  const { data, error } = await supabase
    .from('dispenser_slots')
    .select('*')
    .eq('session_id', session_id)
    .order('slot_index')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DispenserSlotsRow[]
}

export async function getDispenseItemsByMeal(
  session_id: string,
  meal_time: string,
): Promise<DispenseItemsRow[]> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] getDispenseItemsByMeal session=${session_id} meal=${meal_time} -> []`)
    return []
  }

  const { data, error } = await supabase
    .from('dispense_items')
    .select('*')
    .eq('session_id', session_id)
    .eq('meal_time', meal_time)
    .order('slot_index')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as DispenseItemsRow[]
}

export async function updateSessionStatus(
  session_id: string,
  status: string,
): Promise<void> {
  if (USE_MOCK) {
    console.log(`[dispenseFill mock] updateSessionStatus session=${session_id} status=${status}`)
    return
  }

  const { error } = await supabase
    .from('dispense_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', session_id)
  if (error) throw new Error(error.message)
}
