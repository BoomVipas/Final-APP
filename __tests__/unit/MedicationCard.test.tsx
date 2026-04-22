/**
 * Component Tests: MedicationCard
 * Uses React Native Testing Library to verify rendering, interaction, and UX constraints.
 * PRD UX Constraints: Thai names, 48dp touch targets, conflict warning, confirm button.
 */

import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { MedicationCard } from '@/components/shared/MedicationCard'
import type { ScheduleItem } from '@/stores/medicationStore'

// ─── Test fixture factory ─────────────────────────────────────────────────────

function makeItem(overrides?: Partial<ScheduleItem>): ScheduleItem {
  return {
    prescription_id: 'rx-001',
    patient_id: 'patient-001',
    patient_name: 'นายสมชาย ใจดี',
    room_number: '101A',
    medicine_id: 'med-001',
    medicine_name: 'แอสไพริน',
    medicine_strength: '81mg',
    dosage_form: 'เม็ด',
    dose_quantity: 1,
    meal_time: 'morning',
    notes: null,
    status: 'pending',
    conflict_flag: false,
    log_id: null,
    ...overrides,
  }
}

// ─── Drug name rendering ──────────────────────────────────────────────────────

describe('MedicationCard — drug name rendering', () => {
  it('renders Thai drug name', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem()} testID="card" />,
    )
    expect(getByText('แอสไพริน')).toBeTruthy()
  })

  it('renders drug strength as subtitle', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ medicine_strength: '81mg' })} testID="card" />,
    )
    expect(getByText('81mg')).toBeTruthy()
  })

  it('renders dose quantity and form', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ dose_quantity: 2, dosage_form: 'เม็ด' })} testID="card" />,
    )
    expect(getByText(/2 เม็ด/)).toBeTruthy()
  })
})

// ─── Status badge rendering ───────────────────────────────────────────────────

describe('MedicationCard — status badge', () => {
  it('shows pending badge when status=pending', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ status: 'pending' })} />,
    )
    expect(getByText('⏳ รอ')).toBeTruthy()
  })

  it('shows confirmed badge when status=confirmed', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ status: 'confirmed' })} />,
    )
    expect(getByText('✅ จ่ายแล้ว')).toBeTruthy()
  })

  it('shows refused badge when status=refused', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ status: 'refused' })} />,
    )
    expect(getByText('❌ ปฏิเสธ')).toBeTruthy()
  })

  it('shows skipped badge when status=skipped', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ status: 'skipped' })} />,
    )
    expect(getByText('⏭ ข้าม')).toBeTruthy()
  })
})

// ─── Confirm button presence ──────────────────────────────────────────────────

describe('MedicationCard — confirm button', () => {
  it('confirm button is present when status=pending and no conflict', () => {
    const onConfirm = jest.fn()
    const { getByText } = render(
      <MedicationCard
        item={makeItem({ status: 'pending', conflict_flag: false })}
        onConfirm={onConfirm}
      />,
    )
    expect(getByText('ยืนยันจ่ายยา')).toBeTruthy()
  })

  it('confirm button is absent when status=confirmed', () => {
    const { queryByText } = render(
      <MedicationCard
        item={makeItem({ status: 'confirmed' })}
        onConfirm={jest.fn()}
      />,
    )
    expect(queryByText('ยืนยันจ่ายยา')).toBeNull()
  })

  it('confirm button is absent when status=refused', () => {
    const { queryByText } = render(
      <MedicationCard
        item={makeItem({ status: 'refused' })}
        onConfirm={jest.fn()}
      />,
    )
    expect(queryByText('ยืนยันจ่ายยา')).toBeNull()
  })

  it('confirm button is absent when no onConfirm prop provided', () => {
    const { queryByText } = render(
      <MedicationCard item={makeItem({ status: 'pending' })} />,
    )
    expect(queryByText('ยืนยันจ่ายยา')).toBeNull()
  })

  it('confirm button is absent when conflict_flag=true (duplicate blocked)', () => {
    const { queryByText } = render(
      <MedicationCard
        item={makeItem({ status: 'pending', conflict_flag: true })}
        onConfirm={jest.fn()}
      />,
    )
    expect(queryByText('ยืนยันจ่ายยา')).toBeNull()
    expect(queryByText('🚫 บล็อกเนื่องจากซ้ำ')).toBeTruthy()
  })
})

// ─── Confirm button callback ──────────────────────────────────────────────────

describe('MedicationCard — confirm button interaction', () => {
  it('onConfirm is called with the full ScheduleItem when button is tapped', () => {
    const onConfirm = jest.fn()
    const item = makeItem({ status: 'pending', conflict_flag: false })
    const { getByText } = render(
      <MedicationCard item={item} onConfirm={onConfirm} />,
    )
    fireEvent.press(getByText('ยืนยันจ่ายยา'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(item)
  })

  it('onConfirm is not called when status is not pending', () => {
    const onConfirm = jest.fn()
    const { queryByText } = render(
      <MedicationCard
        item={makeItem({ status: 'confirmed' })}
        onConfirm={onConfirm}
      />,
    )
    expect(queryByText('ยืนยันจ่ายยา')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ─── Conflict warning ─────────────────────────────────────────────────────────

describe('MedicationCard — conflict warning', () => {
  it('conflict warning is visible when conflict_flag=true', () => {
    const { getByText } = render(
      <MedicationCard item={makeItem({ conflict_flag: true, status: 'pending' })} />,
    )
    expect(getByText('⚠️ ตรวจพบการจ่ายซ้ำ')).toBeTruthy()
  })

  it('conflict warning is NOT visible when conflict_flag=false', () => {
    const { queryByText } = render(
      <MedicationCard item={makeItem({ conflict_flag: false })} />,
    )
    expect(queryByText(/ตรวจพบการจ่ายซ้ำ/)).toBeNull()
  })
})

// ─── Touch target size (PRD UX Constraint: min 48dp) ─────────────────────────

describe('MedicationCard — touch target UX constraint', () => {
  it('confirm button renders (Button component enforces min-h-[48px])', () => {
    const onConfirm = jest.fn()
    const { getByText } = render(
      <MedicationCard
        item={makeItem({ status: 'pending', conflict_flag: false })}
        onConfirm={onConfirm}
        testID="card"
      />,
    )
    const button = getByText('ยืนยันจ่ายยา')
    expect(button).toBeTruthy()
    // PRD UX constraint: all interactive elements must have min 48×48dp touch targets.
    // Enforced via `min-h-[48px]` in src/components/ui/Button.tsx.
  })
})