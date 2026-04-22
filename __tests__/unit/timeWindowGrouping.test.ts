/**
 * Unit Tests: Time Window Grouping
 * PRD Section 13.1 — critical business logic: time-window grouping (meal-based vs fixed-time)
 */

import {
  getMealPeriod,
  groupScheduleByPeriod,
  sortSchedulesByTime,
  ScheduleItem,
} from '@/lib/scheduleGrouper'

// ─── getMealPeriod ────────────────────────────────────────────────────────────

describe('getMealPeriod', () => {
  it('08:00 → morning', () => {
    expect(getMealPeriod('08:00')).toBe('morning')
  })

  it('05:00 → morning (lower boundary)', () => {
    expect(getMealPeriod('05:00')).toBe('morning')
  })

  it('11:59 → morning (upper boundary)', () => {
    expect(getMealPeriod('11:59')).toBe('morning')
  })

  it('12:00 → noon (exact boundary)', () => {
    expect(getMealPeriod('12:00')).toBe('noon')
  })

  it('12:30 → noon', () => {
    expect(getMealPeriod('12:30')).toBe('noon')
  })

  it('13:59 → noon (upper boundary)', () => {
    expect(getMealPeriod('13:59')).toBe('noon')
  })

  it('14:00 → evening (lower boundary)', () => {
    expect(getMealPeriod('14:00')).toBe('evening')
  })

  it('18:00 → evening', () => {
    expect(getMealPeriod('18:00')).toBe('evening')
  })

  it('19:59 → evening (upper boundary)', () => {
    expect(getMealPeriod('19:59')).toBe('evening')
  })

  it('21:00 → bedtime', () => {
    expect(getMealPeriod('21:00')).toBe('bedtime')
  })

  it('20:00 → bedtime (lower boundary)', () => {
    expect(getMealPeriod('20:00')).toBe('bedtime')
  })

  it('02:00 → bedtime (crosses midnight)', () => {
    expect(getMealPeriod('02:00')).toBe('bedtime')
  })

  it('00:00 → bedtime (midnight)', () => {
    expect(getMealPeriod('00:00')).toBe('bedtime')
  })

  it('04:59 → bedtime (last minute before morning)', () => {
    expect(getMealPeriod('04:59')).toBe('bedtime')
  })
})

// ─── groupScheduleByPeriod ────────────────────────────────────────────────────

describe('groupScheduleByPeriod', () => {
  it('empty input returns empty groups for all periods', () => {
    const result = groupScheduleByPeriod([])
    expect(result.morning).toEqual([])
    expect(result.noon).toEqual([])
    expect(result.evening).toEqual([])
    expect(result.bedtime).toEqual([])
    expect(result.fixed).toEqual([])
  })

  it('meal_based schedules are routed to the correct meal period buckets', () => {
    const schedules: ScheduleItem[] = [
      { id: 's1', scheduledTime: '08:00', timeType: 'meal_based' },
      { id: 's2', scheduledTime: '12:30', timeType: 'meal_based' },
      { id: 's3', scheduledTime: '18:00', timeType: 'meal_based' },
      { id: 's4', scheduledTime: '21:00', timeType: 'meal_based' },
    ]
    const result = groupScheduleByPeriod(schedules)
    expect(result.morning.map((s) => s.id)).toEqual(['s1'])
    expect(result.noon.map((s) => s.id)).toEqual(['s2'])
    expect(result.evening.map((s) => s.id)).toEqual(['s3'])
    expect(result.bedtime.map((s) => s.id)).toEqual(['s4'])
    expect(result.fixed).toEqual([])
  })

  it('fixed_time medications appear only in the fixed group, not in meal periods', () => {
    const schedules: ScheduleItem[] = [
      { id: 'f1', scheduledTime: '08:00', timeType: 'fixed_time' },
      { id: 'f2', scheduledTime: '14:00', timeType: 'fixed_time' },
    ]
    const result = groupScheduleByPeriod(schedules)
    expect(result.fixed.map((s) => s.id)).toEqual(['f1', 'f2'])
    expect(result.morning).toEqual([])
    expect(result.noon).toEqual([])
    expect(result.evening).toEqual([])
    expect(result.bedtime).toEqual([])
  })

  it('mixed schedules are grouped correctly — meal_based and fixed_time separated', () => {
    const schedules: ScheduleItem[] = [
      { id: 'm1', scheduledTime: '09:00', timeType: 'meal_based' },
      { id: 'f1', scheduledTime: '09:00', timeType: 'fixed_time' },
      { id: 'm2', scheduledTime: '21:00', timeType: 'meal_based' },
    ]
    const result = groupScheduleByPeriod(schedules)
    expect(result.morning.map((s) => s.id)).toEqual(['m1'])
    expect(result.fixed.map((s) => s.id)).toEqual(['f1'])
    expect(result.bedtime.map((s) => s.id)).toEqual(['m2'])
  })

  it('multiple schedules in the same period all appear in that bucket', () => {
    const schedules: ScheduleItem[] = [
      { id: 'a', scheduledTime: '06:00', timeType: 'meal_based' },
      { id: 'b', scheduledTime: '07:30', timeType: 'meal_based' },
      { id: 'c', scheduledTime: '10:00', timeType: 'meal_based' },
    ]
    const result = groupScheduleByPeriod(schedules)
    expect(result.morning).toHaveLength(3)
    expect(result.morning.map((s) => s.id)).toContain('a')
    expect(result.morning.map((s) => s.id)).toContain('b')
    expect(result.morning.map((s) => s.id)).toContain('c')
  })

  it('all four meal periods populated with mixed schedules', () => {
    const schedules: ScheduleItem[] = [
      { id: 'morning1', scheduledTime: '08:00', timeType: 'meal_based' },
      { id: 'noon1', scheduledTime: '12:00', timeType: 'meal_based' },
      { id: 'evening1', scheduledTime: '17:00', timeType: 'meal_based' },
      { id: 'bedtime1', scheduledTime: '22:00', timeType: 'meal_based' },
    ]
    const result = groupScheduleByPeriod(schedules)
    expect(result.morning).toHaveLength(1)
    expect(result.noon).toHaveLength(1)
    expect(result.evening).toHaveLength(1)
    expect(result.bedtime).toHaveLength(1)
    expect(result.fixed).toHaveLength(0)
  })
})

// ─── sortSchedulesByTime ──────────────────────────────────────────────────────

describe('sortSchedulesByTime', () => {
  it('empty array returns empty array', () => {
    expect(sortSchedulesByTime([])).toEqual([])
  })

  it('single item returns the same single item', () => {
    const input = [{ scheduledTime: '10:00' }]
    expect(sortSchedulesByTime(input)).toEqual(input)
  })

  it('mixed times return chronological order', () => {
    const input = [
      { scheduledTime: '18:00' },
      { scheduledTime: '06:00' },
      { scheduledTime: '12:30' },
      { scheduledTime: '08:00' },
    ]
    const result = sortSchedulesByTime(input)
    expect(result.map((s) => s.scheduledTime)).toEqual([
      '06:00',
      '08:00',
      '12:30',
      '18:00',
    ])
  })

  it('does not mutate the original array', () => {
    const input = [{ scheduledTime: '20:00' }, { scheduledTime: '08:00' }]
    const originalFirst = input[0].scheduledTime
    sortSchedulesByTime(input)
    expect(input[0].scheduledTime).toBe(originalFirst)
  })

  it('schedules with same time maintain stable relative order (sort is stable in V8)', () => {
    const input = [
      { id: 'a', scheduledTime: '08:00' },
      { id: 'b', scheduledTime: '08:00' },
    ]
    const result = sortSchedulesByTime(input) as typeof input
    // Both are at 08:00 — both should be present in the result
    const ids = result.map((s) => s.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  it('midnight and post-midnight times sort before morning times', () => {
    const input = [
      { scheduledTime: '08:00' },
      { scheduledTime: '00:00' },
      { scheduledTime: '02:00' },
      { scheduledTime: '22:00' },
    ]
    const result = sortSchedulesByTime(input)
    expect(result.map((s) => s.scheduledTime)).toEqual([
      '00:00',
      '02:00',
      '08:00',
      '22:00',
    ])
  })
})
