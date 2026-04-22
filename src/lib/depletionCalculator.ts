/**
 * Depletion Calculator
 * Pure functions for calculating medication stock depletion dates and alert levels.
 * Business logic for PRD Feature F-3: Stock Depletion Alerts.
 */

/**
 * Calculates the projected depletion date given a current stock count and daily consumption rate.
 *
 * @param currentCount - Number of tablets/units currently in stock
 * @param dailyRate    - Number of tablets/units consumed per day (may be fractional, e.g. 0.5 or 1.5)
 * @param fromDate     - Starting date for the calculation; defaults to now
 * @returns            The projected Date on which stock reaches zero
 */
export function calculateDepletionDate(
  currentCount: number,
  dailyRate: number,
  fromDate: Date = new Date()
): Date {
  if (dailyRate <= 0) {
    // No consumption — stock never depletes; return a far-future sentinel date
    return new Date(8640000000000000)
  }

  const daysRemaining = currentCount / dailyRate
  const result = new Date(fromDate)
  // Use fractional milliseconds to preserve full precision before flooring to day
  result.setTime(result.getTime() + daysRemaining * 24 * 60 * 60 * 1000)
  return result
}

/**
 * Calculates the number of whole days of stock remaining.
 * Fractional days are floored — a count of 1 tablet at 1.5/day = 0 full days remaining.
 *
 * @param currentCount - Number of tablets/units currently in stock
 * @param dailyRate    - Number of tablets/units consumed per day
 * @returns            Whole days of stock remaining (floor), minimum 0
 */
export function calculateDaysRemaining(
  currentCount: number,
  dailyRate: number
): number {
  if (dailyRate <= 0) return Infinity
  if (currentCount <= 0) return 0
  return Math.floor(currentCount / dailyRate)
}

/**
 * Returns an alert level based on days remaining versus configured thresholds.
 *
 * @param daysRemaining      - Whole days of stock remaining
 * @param warningThreshold   - Days at or below which a 'warning' is raised (e.g. 7)
 * @param criticalThreshold  - Days at or below which a 'critical' alert is raised (e.g. 3)
 * @returns                  'none' | 'warning' | 'critical'
 */
export function getAlertLevel(
  daysRemaining: number,
  warningThreshold: number,
  criticalThreshold: number
): 'none' | 'warning' | 'critical' {
  if (daysRemaining <= criticalThreshold) return 'critical'
  if (daysRemaining <= warningThreshold) return 'warning'
  return 'none'
}
