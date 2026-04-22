/**
 * src/types/index.ts
 * Central re-export barrel for all PILLo type definitions.
 */

export type {
  // Enums
  UserRole,
  MealTime,
  LogStatus,
  LogMethod,
  ChangeType,
  NotificationChannel,
  NotificationStatus,
  RecipientType,
  DispenseStatus,
  DispenseItemStatus,

  // Row types (select)
  UsersRow,
  PatientsRow,
  MedicinesRow,
  PatientPrescriptionsRow,
  MedicationLogsRow,
  CabinetSlotsRow,
  DispenseSessionsRow,
  DispenseItemsRow,
  DispenserSlotsRow,
  ShiftHandoversRow,
  FamilyContactsRow,
  NotificationLogsRow,
  PrescriptionChangesRow,
  WardsRow,

  // Insert types
  UsersInsert,
  PatientsInsert,
  PatientPrescriptionsInsert,
  MedicationLogsInsert,
  ShiftHandoversInsert,

  // Update types
  UsersUpdate,

  // Supabase Database interface
  Database,
} from './database'