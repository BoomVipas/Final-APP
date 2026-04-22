/**
 * Unit Tests: Shift Handover Summary Aggregation
 * PRD Section 13.1 — critical business logic: shift handover summary aggregation
 */

import {
  aggregateHandoverSummary,
  HandoverInput,
  ScheduleRecord,
  MedicationLogRecord,
  PrescriptionChangeRecord,
  PrnMedicationRecord,
} from '@/lib/handoverAggregator'

const SHIFT_START = new Date('2026-03-24T07:00:00.000Z')
const SHIFT_END   = new Date('2026-03-24T15:00:00.000Z')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<ScheduleRecord> & { id: string }): ScheduleRecord {
  return {
    patientName: 'Patient A',
    medicationName: 'Med A',
    scheduledTime: '08:00',
    ...overrides,
  }
}

function makeLog(
  overrides: Partial<MedicationLogRecord> & { scheduleId: string }
): MedicationLogRecord {
  return {
    status: 'confirmed',
    administeredAt: new Date('2026-03-24T08:05:00.000Z'),
    patientName: 'Patient A',
    medicationName: 'Med A',
    scheduledTime: '08:00',
    ...overrides,
  }
}

function makeChange(
  overrides: Partial<PrescriptionChangeRecord> & { changedAt: Date }
): PrescriptionChangeRecord {
  return {
    patientName: 'Patient A',
    medicationName: 'Med A',
    changeType: 'dosage',
    changedByName: 'Dr. Smith',
    previousValue: '5mg',
    newValue: '10mg',
    ...overrides,
  }
}

function makePrn(overrides?: Partial<PrnMedicationRecord>): PrnMedicationRecord {
  return {
    patientName: 'Patient A',
    medicationName: 'PRN Med',
    instructions: 'As needed for pain',
    ...overrides,
  }
}

function buildInput(overrides?: Partial<HandoverInput>): HandoverInput {
  return {
    medicationLogs: [],
    allSchedules: [],
    prescriptionChanges: [],
    prnMedications: [],
    shiftStart: SHIFT_START,
    shiftEnd: SHIFT_END,
    ...overrides,
  }
}

// ─── All medications given ────────────────────────────────────────────────────

describe('aggregateHandoverSummary — all medications given', () => {
  it('pendingItems is empty when all schedules have confirmed logs', () => {
    const schedule = makeSchedule({ id: 's1' })
    const log = makeLog({ scheduleId: 's1' })
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: [schedule],
      medicationLogs: [log],
    }))
    expect(result.pendingItems).toHaveLength(0)
    expect(result.patientsWithPending).toHaveLength(0)
  })
})

// ─── Some medications not given ───────────────────────────────────────────────

describe('aggregateHandoverSummary — some medications not given', () => {
  it('pendingItems includes unconfirmed schedule with scheduled time', () => {
    const schedule = makeSchedule({ id: 's-missing', scheduledTime: '14:00', medicationName: 'Missing Med' })
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: [schedule],
      medicationLogs: [],
    }))
    expect(result.pendingItems).toHaveLength(1)
    expect(result.pendingItems[0].scheduleId).toBe('s-missing')
    expect(result.pendingItems[0].scheduledTime).toBe('14:00')
    expect(result.pendingItems[0].medicationName).toBe('Missing Med')
  })

  it('confirmed schedules are excluded from pending; unconfirmed are included', () => {
    const s1 = makeSchedule({ id: 's1', medicationName: 'Confirmed Med' })
    const s2 = makeSchedule({ id: 's2', medicationName: 'Pending Med' })
    const log = makeLog({ scheduleId: 's1' })
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: [s1, s2],
      medicationLogs: [log],
    }))
    expect(result.pendingItems).toHaveLength(1)
    expect(result.pendingItems[0].scheduleId).toBe('s2')
  })

  it('refused and skipped logs do not satisfy pending — those schedules remain pending', () => {
    const schedule = makeSchedule({ id: 's-refused' })
    const log = makeLog({ scheduleId: 's-refused', status: 'refused' })
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: [schedule],
      medicationLogs: [log],
    }))
    expect(result.pendingItems).toHaveLength(1)
    expect(result.pendingItems[0].scheduleId).toBe('s-refused')
  })
})

// ─── Prescription changes ─────────────────────────────────────────────────────

describe('aggregateHandoverSummary — prescription changes', () => {
  it('prescription change BEFORE shift start is NOT included', () => {
    const beforeShift = new Date(SHIFT_START.getTime() - 1000)
    const result = aggregateHandoverSummary(buildInput({
      prescriptionChanges: [makeChange({ changedAt: beforeShift })],
    }))
    expect(result.prescriptionChanges).toHaveLength(0)
  })

  it('prescription change AT shift start is NOT included (strict after)', () => {
    const result = aggregateHandoverSummary(buildInput({
      prescriptionChanges: [makeChange({ changedAt: SHIFT_START })],
    }))
    expect(result.prescriptionChanges).toHaveLength(0)
  })

  it('prescription change DURING shift is included', () => {
    const duringShift = new Date(SHIFT_START.getTime() + 3 * 60 * 60 * 1000)
    const result = aggregateHandoverSummary(buildInput({
      prescriptionChanges: [makeChange({ changedAt: duringShift })],
    }))
    expect(result.prescriptionChanges).toHaveLength(1)
  })

  it('prescription change AFTER shift end is NOT included when shiftEnd provided', () => {
    const afterShift = new Date(SHIFT_END!.getTime() + 1000)
    const result = aggregateHandoverSummary(buildInput({
      prescriptionChanges: [makeChange({ changedAt: afterShift })],
    }))
    expect(result.prescriptionChanges).toHaveLength(0)
  })

  it('prescription change AT shift end IS included (inclusive upper bound)', () => {
    const result = aggregateHandoverSummary(buildInput({
      prescriptionChanges: [makeChange({ changedAt: SHIFT_END! })],
    }))
    expect(result.prescriptionChanges).toHaveLength(1)
  })

  it('when no shiftEnd, all changes after shiftStart are included', () => {
    const farFuture = new Date('2026-12-31T23:59:00.000Z')
    const result = aggregateHandoverSummary(buildInput({
      shiftEnd: undefined,
      prescriptionChanges: [makeChange({ changedAt: farFuture })],
    }))
    expect(result.prescriptionChanges).toHaveLength(1)
  })
})

// ─── PRN medications ──────────────────────────────────────────────────────────

describe('aggregateHandoverSummary — PRN medications', () => {
  it('PRN medications are always included regardless of timing', () => {
    const prn = makePrn()
    const result = aggregateHandoverSummary(buildInput({
      prnMedications: [prn],
    }))
    expect(result.prnMedications).toHaveLength(1)
    expect(result.prnMedications[0].medicationName).toBe('PRN Med')
  })

  it('multiple PRN medications are all included', () => {
    const result = aggregateHandoverSummary(buildInput({
      prnMedications: [
        makePrn({ medicationName: 'PRN A' }),
        makePrn({ medicationName: 'PRN B' }),
        makePrn({ patientName: 'Patient B', medicationName: 'PRN C' }),
      ],
    }))
    expect(result.prnMedications).toHaveLength(3)
  })
})

// ─── Patient grouping ─────────────────────────────────────────────────────────

describe('aggregateHandoverSummary — patient grouping', () => {
  it('patient with no medications is not listed in patientsWithPending', () => {
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: [],
      medicationLogs: [],
    }))
    expect(result.patientsWithPending).toHaveLength(0)
  })

  it('multiple patients — patientsWithPending lists only those with pending items', () => {
    const schedules = [
      makeSchedule({ id: 's1', patientName: 'Alice' }),
      makeSchedule({ id: 's2', patientName: 'Bob' }),
      makeSchedule({ id: 's3', patientName: 'Charlie' }),
    ]
    // Alice and Charlie confirmed; Bob not
    const logs = [
      makeLog({ scheduleId: 's1', patientName: 'Alice' }),
      makeLog({ scheduleId: 's3', patientName: 'Charlie' }),
    ]
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: schedules,
      medicationLogs: logs,
    }))
    expect(result.patientsWithPending).toEqual(['Bob'])
    expect(result.pendingItems).toHaveLength(1)
    expect(result.pendingItems[0].patientName).toBe('Bob')
  })

  it('a patient with multiple pending medications appears once in patientsWithPending', () => {
    const schedules = [
      makeSchedule({ id: 's1', patientName: 'Alice', medicationName: 'Med 1' }),
      makeSchedule({ id: 's2', patientName: 'Alice', medicationName: 'Med 2' }),
    ]
    const result = aggregateHandoverSummary(buildInput({
      allSchedules: schedules,
      medicationLogs: [],
    }))
    expect(result.pendingItems).toHaveLength(2)
    expect(result.patientsWithPending).toEqual(['Alice'])
  })
})

// ─── Empty ward ───────────────────────────────────────────────────────────────

describe('aggregateHandoverSummary — empty ward (no patients)', () => {
  it('all sections are empty arrays when no data provided', () => {
    const result = aggregateHandoverSummary(buildInput())
    expect(result.pendingItems).toEqual([])
    expect(result.prescriptionChanges).toEqual([])
    expect(result.prnMedications).toEqual([])
    expect(result.patientsWithPending).toEqual([])
  })
})
