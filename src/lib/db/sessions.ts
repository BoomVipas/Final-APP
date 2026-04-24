import { supabase } from '../supabase'
import type { DispenseSessionsRow, DispenseItemsRow, DispenserSlotsRow } from '../../types/database'

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function createDispenseSession(
  patientId: string,
  wardId: string,
  initiatedBy?: string,
): Promise<DispenseSessionsRow> {
  const { data, error } = await supabase
    .from('dispense_sessions')
    .insert({
      patient_id:   patientId,
      ward_id:      wardId,
      initiated_by: initiatedBy ?? null,
      session_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
      status:       'pending',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateSessionStatus(
  sessionId: string,
  status: DispenseSessionsRow['status'],
): Promise<void> {
  const { error } = await supabase
    .from('dispense_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
}

// ─── Dispenser slots ──────────────────────────────────────────────────────────

export async function upsertDispenserSlot(
  sessionId:    string,
  slotIndex:    number,
  medicineId:   string,
  patientId:    string,
  doseQuantity: number,
  mealTimes:    string[],
): Promise<void> {
  const { error } = await supabase
    .from('dispenser_slots')
    .upsert(
      {
        session_id:    sessionId,
        slot_index:    slotIndex,
        medicine_id:   medicineId,
        patient_id:    patientId,
        dose_quantity: doseQuantity,
        meal_times:    mealTimes,
        confirmed:     false,
      },
      { onConflict: 'session_id,slot_index' },
    )

  if (error) throw new Error(error.message)
}

export async function confirmDispenserSlot(
  sessionId: string,
  slotIndex:  number,
): Promise<void> {
  const { error } = await supabase
    .from('dispenser_slots')
    .update({ confirmed: true })
    .eq('session_id', sessionId)
    .eq('slot_index', slotIndex)

  if (error) throw new Error(error.message)
}

export async function getDispenserSlots(sessionId: string): Promise<DispenserSlotsRow[]> {
  const { data, error } = await supabase
    .from('dispenser_slots')
    .select('*')
    .eq('session_id', sessionId)
    .order('slot_index')

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Dispense items ───────────────────────────────────────────────────────────

export async function generateDispenseItems(sessionId: string): Promise<void> {
  const { data: slots, error: slotsError } = await supabase
    .from('dispenser_slots')
    .select('*')
    .eq('session_id', sessionId)
    .eq('confirmed', true)

  if (slotsError) throw new Error(slotsError.message)
  if (!slots || slots.length === 0) throw new Error('No confirmed slots found')

  const items = slots.flatMap((slot: DispenserSlotsRow) =>
    slot.meal_times.map((mealTime: string) => ({
      session_id:  sessionId,
      patient_id:  slot.patient_id,
      medicine_id: slot.medicine_id,
      slot_index:  slot.slot_index,
      meal_time:   mealTime,
      quantity:    slot.dose_quantity,
      status:      'queued',
    })),
  )

  const { error } = await supabase.from('dispense_items').insert(items)
  if (error) throw new Error(error.message)
}

export async function getDispenseItemsByMeal(
  sessionId: string,
  mealTime:  'morning' | 'noon' | 'evening' | 'night',
): Promise<DispenseItemsRow[]> {
  const { data, error } = await supabase
    .from('dispense_items')
    .select('*')
    .eq('session_id', sessionId)
    .eq('meal_time', mealTime)
    .order('slot_index')

  if (error) throw new Error(error.message)
  return data ?? []
}
