/**
 * Unit Tests: Depletion Calculator
 * PRD Section 13.1 — critical business logic: depletion date calculation
 */

import {
  calculateDepletionDate,
  calculateDaysRemaining,
  getAlertLevel,
} from '@/lib/depletionCalculator'

// ─── calculateDaysRemaining ───────────────────────────────────────────────────

describe('calculateDaysRemaining', () => {
  it('standard whole tablet: 30 tablets at 1/day = 30 days', () => {
    expect(calculateDaysRemaining(30, 1)).toBe(30)
  })

  it('fractional dose: 30 tablets at 1.5/day = 20 days', () => {
    // 30 / 1.5 = 20 exactly
    expect(calculateDaysRemaining(30, 1.5)).toBe(20)
  })

  it('half tablet: 14 tablets at 0.5/day = 28 days', () => {
    // 14 / 0.5 = 28
    expect(calculateDaysRemaining(14, 0.5)).toBe(28)
  })

  it('zero count: 0 tablets = 0 days remaining', () => {
    expect(calculateDaysRemaining(0, 1)).toBe(0)
  })

  it('negative count treated as 0 days remaining', () => {
    expect(calculateDaysRemaining(-5, 1)).toBe(0)
  })

  it('count less than one day dose: floors to 0 days', () => {
    // 0.5 tablets at 1/day → cannot complete one full day
    expect(calculateDaysRemaining(0.5, 1)).toBe(0)
  })

  it('fractional result is floored: 7 tablets at 3/day = 2 days (not 2.33)', () => {
    expect(calculateDaysRemaining(7, 3)).toBe(2)
  })

  it('zero daily rate returns Infinity (no consumption)', () => {
    expect(calculateDaysRemaining(30, 0)).toBe(Infinity)
  })
})

// ─── calculateDepletionDate ───────────────────────────────────────────────────

describe('calculateDepletionDate', () => {
  const baseDate = new Date('2026-01-01T00:00:00.000Z')

  it('standard: 30 tablets at 1/day depletes in exactly 30 days', () => {
    const result = calculateDepletionDate(30, 1, baseDate)
    const expected = new Date('2026-01-31T00:00:00.000Z')
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('fractional dose: 30 tablets at 1.5/day depletes in 20 days', () => {
    const result = calculateDepletionDate(30, 1.5, baseDate)
    const expected = new Date('2026-01-21T00:00:00.000Z')
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('half tablet dose: 14 tablets at 0.5/day depletes in 28 days', () => {
    const result = calculateDepletionDate(14, 0.5, baseDate)
    const expected = new Date('2026-01-29T00:00:00.000Z')
    expect(result.getTime()).toBe(expected.getTime())
  })

  it('zero stock depletes immediately (returns fromDate)', () => {
    const result = calculateDepletionDate(0, 1, baseDate)
    expect(result.getTime()).toBe(baseDate.getTime())
  })

  it('zero daily rate returns far-future sentinel date', () => {
    const result = calculateDepletionDate(30, 0, baseDate)
    // Should be the maximum date value
    expect(result.getTime()).toBe(new Date(8640000000000000).getTime())
  })

  it('uses current date when fromDate is omitted', () => {
    const before = Date.now()
    const result = calculateDepletionDate(10, 1)
    const after = Date.now()
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000
    expect(result.getTime()).toBeGreaterThanOrEqual(before + tenDaysMs)
    expect(result.getTime()).toBeLessThanOrEqual(after + tenDaysMs)
  })
})

// ─── getAlertLevel ────────────────────────────────────────────────────────────

describe('getAlertLevel', () => {
  const WARNING_THRESHOLD = 7
  const CRITICAL_THRESHOLD = 3

  it('well-stocked (30 days): returns none', () => {
    expect(getAlertLevel(30, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('none')
  })

  it('exactly at warning threshold (7 days): returns warning', () => {
    expect(getAlertLevel(7, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('warning')
  })

  it('within warning range (5 days): returns warning', () => {
    expect(getAlertLevel(5, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('warning')
  })

  it('exactly at critical threshold (3 days): returns critical', () => {
    expect(getAlertLevel(3, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('critical')
  })

  it('below critical threshold (2 days): returns critical', () => {
    expect(getAlertLevel(2, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('critical')
  })

  it('zero days remaining: returns critical', () => {
    expect(getAlertLevel(0, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('critical')
  })

  it('one day above warning threshold (8 days): returns none', () => {
    expect(getAlertLevel(8, WARNING_THRESHOLD, CRITICAL_THRESHOLD)).toBe('none')
  })

  it('critical threshold takes precedence when it equals warning threshold', () => {
    // Edge: same threshold value — critical wins
    expect(getAlertLevel(5, 5, 5)).toBe('critical')
  })
})
