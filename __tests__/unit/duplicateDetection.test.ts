/**
 * Unit Tests: Duplicate Dose Detection
 * PRD Section 13.1 — critical business logic: anti-duplicate conflict detection
 *
 * Boundary behaviour (documented decision):
 *   The time window uses an EXCLUSIVE lower bound.
 *   A log at exactly (checkTime - windowMinutes) is treated as OUTSIDE the window
 *   and therefore NOT a duplicate. When in doubt, we allow re-administration
 *   rather than silently blocking a caregiver.
 */

import {
  checkDuplicateDose,
  MedicationLogEntry,
} from '@/lib/duplicateDetection'

const BASE_TIME = new Date('2026-03-24T10:00:00.000Z')
const WINDOW = 60 // minutes

function makeLog(
  overrides: Partial<MedicationLogEntry> & { administeredAt: Date }
): MedicationLogEntry {
  return {
    id: 'log-1',
    scheduleId: 'sched-1',
    status: 'confirmed',
    caregiverName: 'Nurse A',
    ...overrides,
  }
}

// ─── No logs ──────────────────────────────────────────────────────────────────

describe('checkDuplicateDose — no existing logs', () => {
  it('returns isDuplicate=false when there are no logs at all', () => {
    const result = checkDuplicateDose('sched-1', WINDOW, [], BASE_TIME)
    expect(result.isDuplicate).toBe(false)
    expect(result.conflictingLog).toBeUndefined()
  })
})

// ─── Logs outside the window ──────────────────────────────────────────────────

describe('checkDuplicateDose — log outside time window', () => {
  it('does not flag duplicate when log is 2 hours ago (outside 60-min window)', () => {
    const twoHoursAgo = new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000)
    const logs = [makeLog({ administeredAt: twoHoursAgo })]
    const result = checkDuplicateDose('sched-1', WINDOW, logs, BASE_TIME)
    expect(result.isDuplicate).toBe(false)
  })

  it('does not flag duplicate for a different scheduleId within the window', () => {
    const thirtyMinsAgo = new Date(BASE_TIME.getTime() - 30 * 60 * 1000)
    const logs = [makeLog({ scheduleId: 'sched-OTHER', administeredAt: thirtyMinsAgo })]
    const result = checkDuplicateDose('sched-1', WINDOW, logs, BASE_TIME)
    expect(result.isDuplicate).toBe(false)
  })
})

// ─── Logs inside the window ───────────────────────────────────────────────────

describe('checkDuplicateDose — log inside time window', () => {
  it('detects duplicate when a confirmed log exists 30 minutes ago', () => {
    const thirtyMinsAgo = new Date(BASE_TIME.getTime() - 30 * 60 * 1000)
    const log = makeLog({ administeredAt: thirtyMinsAgo })
    const result = checkDuplicateDose('sched-1', WINDOW, [log], BASE_TIME)
    expect(result.isDuplicate).toBe(true)
    expect(result.conflictingLog).toBe(log)
  })

  it('returns the specific conflicting log object', () => {
    const tenMinsAgo = new Date(BASE_TIME.getTime() - 10 * 60 * 1000)
    const conflictLog = makeLog({ id: 'log-conflict', administeredAt: tenMinsAgo })
    const otherLog = makeLog({
      id: 'log-old',
      scheduleId: 'sched-1',
      administeredAt: new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000),
    })
    const result = checkDuplicateDose('sched-1', WINDOW, [otherLog, conflictLog], BASE_TIME)
    expect(result.isDuplicate).toBe(true)
    expect(result.conflictingLog?.id).toBe('log-conflict')
  })
})

// ─── Refused / skipped logs ───────────────────────────────────────────────────

describe('checkDuplicateDose — refused and skipped logs do not count as duplicates', () => {
  it('does NOT flag duplicate when log within window has status=refused', () => {
    const thirtyMinsAgo = new Date(BASE_TIME.getTime() - 30 * 60 * 1000)
    const log = makeLog({ status: 'refused', administeredAt: thirtyMinsAgo })
    const result = checkDuplicateDose('sched-1', WINDOW, [log], BASE_TIME)
    expect(result.isDuplicate).toBe(false)
  })

  it('does NOT flag duplicate when log within window has status=skipped', () => {
    const thirtyMinsAgo = new Date(BASE_TIME.getTime() - 30 * 60 * 1000)
    const log = makeLog({ status: 'skipped', administeredAt: thirtyMinsAgo })
    const result = checkDuplicateDose('sched-1', WINDOW, [log], BASE_TIME)
    expect(result.isDuplicate).toBe(false)
  })
})

// ─── Multiple logs ────────────────────────────────────────────────────────────

describe('checkDuplicateDose — multiple logs', () => {
  it('detects duplicate for the in-window log when multiple logs exist', () => {
    const inWindowLog = makeLog({
      id: 'in-window',
      administeredAt: new Date(BASE_TIME.getTime() - 30 * 60 * 1000),
    })
    const outWindowLog = makeLog({
      id: 'out-window',
      administeredAt: new Date(BASE_TIME.getTime() - 90 * 60 * 1000),
    })
    const result = checkDuplicateDose('sched-1', WINDOW, [outWindowLog, inWindowLog], BASE_TIME)
    expect(result.isDuplicate).toBe(true)
    expect(result.conflictingLog?.id).toBe('in-window')
  })

  it('finds no duplicate when only out-of-window confirmed logs exist', () => {
    const logs = [
      makeLog({ id: 'a', administeredAt: new Date(BASE_TIME.getTime() - 2 * 60 * 60 * 1000) }),
      makeLog({ id: 'b', administeredAt: new Date(BASE_TIME.getTime() - 3 * 60 * 60 * 1000) }),
    ]
    const result = checkDuplicateDose('sched-1', WINDOW, logs, BASE_TIME)
    expect(result.isDuplicate).toBe(false)
  })
})

// ─── Boundary behaviour (documented) ─────────────────────────────────────────

describe('checkDuplicateDose — boundary behaviour (exclusive lower bound)', () => {
  it('log at EXACTLY the window edge is NOT a duplicate (exclusive lower bound)', () => {
    // Exactly 60 minutes ago = the boundary moment
    const exactBoundary = new Date(BASE_TIME.getTime() - WINDOW * 60 * 1000)
    const log = makeLog({ administeredAt: exactBoundary })
    const result = checkDuplicateDose('sched-1', WINDOW, [log], BASE_TIME)
    // Decision: exclusive lower bound → boundary is outside window → not duplicate
    expect(result.isDuplicate).toBe(false)
  })

  it('log one millisecond inside the window IS a duplicate', () => {
    const justInsideBoundary = new Date(BASE_TIME.getTime() - WINDOW * 60 * 1000 + 1)
    const log = makeLog({ administeredAt: justInsideBoundary })
    const result = checkDuplicateDose('sched-1', WINDOW, [log], BASE_TIME)
    expect(result.isDuplicate).toBe(true)
  })
})
