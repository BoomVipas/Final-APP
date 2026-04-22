/**
 * Handover Aggregator
 * Pure function for generating shift handover summaries.
 * Business logic for PRD Feature F-1: Shift Handover.
 */

export interface MedicationLogRecord {
  scheduleId: string
  status: string
  administeredAt: Date
  patientName: string
  medicationName: string
  scheduledTime: string
}

export interface ScheduleRecord {
  id: string
  patientName: string
  medicationName: string
  scheduledTime: string
}

export interface PrescriptionChangeRecord {
  patientName: string
  medicationName: string
  changeType: string
  changedAt: Date
  changedByName: string
  previousValue: unknown
  newValue: unknown
}

export interface PrnMedicationRecord {
  patientName: string
  medicationName: string
  instructions: string
}

export interface HandoverInput {
  medicationLogs: MedicationLogRecord[]
  allSchedules: ScheduleRecord[]
  prescriptionChanges: PrescriptionChangeRecord[]
  prnMedications: PrnMedicationRecord[]
  shiftStart: Date
  shiftEnd?: Date
}

export interface PendingItem {
  scheduleId: string
  patientName: string
  medicationName: string
  scheduledTime: string
}

export interface HandoverSummary {
  /** Scheduled doses that were NOT confirmed during this shift */
  pendingItems: PendingItem[]
  /** Prescription changes that occurred during this shift */
  prescriptionChanges: PrescriptionChangeRecord[]
  /** PRN (as-needed) medications — always included for awareness */
  prnMedications: PrnMedicationRecord[]
  /** Unique patient names who have at least one pending item */
  patientsWithPending: string[]
}

/**
 * Aggregates a shift handover summary from raw shift data.
 *
 * Rules:
 * - A schedule is "pending" if no log with status='confirmed' exists for it.
 * - Only prescription changes with changedAt strictly after shiftStart (and
 *   before or equal to shiftEnd when provided) are included.
 * - PRN medications are always included regardless of timing.
 * - Patients with no pending items are not listed in patientsWithPending.
 *
 * @param input - HandoverInput containing all shift data
 * @returns HandoverSummary
 */
export function aggregateHandoverSummary(input: HandoverInput): HandoverSummary {
  const {
    medicationLogs,
    allSchedules,
    prescriptionChanges,
    prnMedications,
    shiftStart,
    shiftEnd,
  } = input

  // Build a set of confirmed schedule IDs for fast lookup
  const confirmedScheduleIds = new Set<string>()
  for (const log of medicationLogs) {
    if (log.status === 'confirmed') {
      confirmedScheduleIds.add(log.scheduleId)
    }
  }

  // Determine pending items
  const pendingItems: PendingItem[] = []
  for (const schedule of allSchedules) {
    if (!confirmedScheduleIds.has(schedule.id)) {
      pendingItems.push({
        scheduleId: schedule.id,
        patientName: schedule.patientName,
        medicationName: schedule.medicationName,
        scheduledTime: schedule.scheduledTime,
      })
    }
  }

  // Filter prescription changes to those within the shift window
  // changedAt must be strictly after shiftStart
  const filteredChanges = prescriptionChanges.filter((change) => {
    const changedAt = change.changedAt instanceof Date
      ? change.changedAt
      : new Date(change.changedAt as string)
    if (changedAt <= shiftStart) return false
    if (shiftEnd && changedAt > shiftEnd) return false
    return true
  })

  // Unique patients who have pending items
  const patientsWithPending = [...new Set(pendingItems.map((p) => p.patientName))]

  return {
    pendingItems,
    prescriptionChanges: filteredChanges,
    prnMedications,
    patientsWithPending,
  }
}
