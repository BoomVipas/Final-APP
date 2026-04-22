/**
 * Schedule Grouper
 * Pure functions for time-window grouping of medication schedules.
 * Business logic for PRD Feature F-2: Medication Reminders (meal-based vs fixed-time).
 *
 * Meal period definitions (24-hour HH:MM):
 *   morning  — 05:00 to 11:59
 *   noon     — 12:00 to 13:59
 *   evening  — 14:00 to 19:59
 *   bedtime  — 20:00 to 04:59  (wraps midnight)
 */

export type MealPeriod = 'morning' | 'noon' | 'evening' | 'bedtime' | 'fixed'

export interface ScheduleItem {
  id: string
  scheduledTime: string            // "HH:MM" 24-hour format
  timeType: 'meal_based' | 'fixed_time'
}

/**
 * Returns the meal period that a given time string falls into.
 * 'fixed' is never returned by this function — use groupScheduleByPeriod for that.
 *
 * @param scheduledTime - Time in "HH:MM" 24-hour format
 * @returns MealPeriod (excluding 'fixed')
 */
export function getMealPeriod(scheduledTime: string): Exclude<MealPeriod, 'fixed'> {
  const [hourStr, minuteStr] = scheduledTime.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = parseInt(minuteStr, 10)

  // Convert to total minutes for easy comparison
  const totalMinutes = hour * 60 + minute

  // morning: 05:00 (300) to 11:59 (719)
  if (totalMinutes >= 300 && totalMinutes <= 719) return 'morning'
  // noon: 12:00 (720) to 13:59 (839)
  if (totalMinutes >= 720 && totalMinutes <= 839) return 'noon'
  // evening: 14:00 (840) to 19:59 (1199)
  if (totalMinutes >= 840 && totalMinutes <= 1199) return 'evening'
  // bedtime: 20:00 (1200) to 04:59 (next day, 0–299)
  // This covers totalMinutes >= 1200 OR totalMinutes < 300
  return 'bedtime'
}

/**
 * Groups an array of schedules into meal-period buckets.
 * Schedules with timeType='fixed_time' are placed in the 'fixed' group.
 * Schedules with timeType='meal_based' are bucketed by getMealPeriod.
 *
 * @param schedules - Array of schedule items
 * @returns Record keyed by MealPeriod, each value is the subset of schedules in that period
 */
export function groupScheduleByPeriod(
  schedules: ScheduleItem[]
): Record<MealPeriod, ScheduleItem[]> {
  const result: Record<MealPeriod, ScheduleItem[]> = {
    morning: [],
    noon: [],
    evening: [],
    bedtime: [],
    fixed: [],
  }

  for (const schedule of schedules) {
    if (schedule.timeType === 'fixed_time') {
      result.fixed.push(schedule)
    } else {
      const period = getMealPeriod(schedule.scheduledTime)
      result[period].push(schedule)
    }
  }

  return result
}

/**
 * Sorts an array of schedule-like objects chronologically by scheduledTime.
 * Schedules crossing midnight (bedtime period that wraps) sort after 20:00 entries
 * and before 05:00 entries — in natural 00:00–23:59 order.
 *
 * @param schedules - Array with at least a scheduledTime "HH:MM" field
 * @returns New sorted array (does not mutate input)
 */
export function sortSchedulesByTime<T extends { scheduledTime: string }>(
  schedules: T[]
): T[] {
  return [...schedules].sort((a, b) => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    return toMinutes(a.scheduledTime) - toMinutes(b.scheduledTime)
  })
}
