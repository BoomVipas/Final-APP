/**
 * Duplicate Dose Detection
 * Pure functions for detecting duplicate medication administrations within a time window.
 * Business logic for PRD Feature F-2: Medication Reminders + Anti-Duplicate.
 *
 * Design decision — boundary behaviour:
 *   A log at EXACTLY the edge of the window (administeredAt === checkTime - windowMinutes)
 *   is treated as OUTSIDE the window (exclusive lower bound).
 *   i.e., the window covers: (checkTime - windowMinutes, checkTime]
 *   This is the safest default: when in doubt, allow re-administration rather than
 *   silently blocking a dose.
 */

export interface MedicationLogEntry {
  id: string
  scheduleId: string
  administeredAt: Date
  status: 'confirmed' | 'refused' | 'skipped'
  caregiverName?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  conflictingLog?: MedicationLogEntry
}

/**
 * Checks whether a dose has already been administered within the given time window.
 *
 * Only logs with status='confirmed' count as duplicates.
 * 'refused' and 'skipped' logs are excluded so caregivers can re-administer when needed.
 *
 * @param scheduleId         - The medication schedule ID to check
 * @param timeWindowMinutes  - Look-back window in minutes (exclusive lower bound)
 * @param existingLogs       - All known logs (may span multiple schedules/patients)
 * @param checkTime          - Point in time to check from; defaults to now
 * @returns                  { isDuplicate, conflictingLog }
 */
export function checkDuplicateDose(
  scheduleId: string,
  timeWindowMinutes: number,
  existingLogs: MedicationLogEntry[],
  checkTime: Date = new Date()
): DuplicateCheckResult {
  const windowStart = new Date(
    checkTime.getTime() - timeWindowMinutes * 60 * 1000
  )

  for (const log of existingLogs) {
    if (log.scheduleId !== scheduleId) continue
    if (log.status !== 'confirmed') continue

    const administeredAt = log.administeredAt instanceof Date
      ? log.administeredAt
      : new Date(log.administeredAt)

    // Exclusive lower bound: strictly greater than windowStart
    if (administeredAt > windowStart && administeredAt <= checkTime) {
      return { isDuplicate: true, conflictingLog: log }
    }
  }

  return { isDuplicate: false }
}
