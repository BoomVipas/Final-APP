/**
 * src/mocks/data.ts
 *
 * Complete mock dataset for PILLo UI testing.
 * Covers: user, 4 ward-1 patients, today's schedule (mixed statuses),
 * stock alerts, prescription changes, handover, notifications.
 *
 * Set USE_MOCK = true in src/mocks/index.ts to activate.
 */

import type {
  UsersRow,
  PatientsRow,
  MedicinesRow,
  NotificationLogsRow,
} from '../types/database'
import type { ScheduleGroup, ScheduleItem } from '../stores/medicationStore'
import type { AppAlert } from '../stores/notificationStore'

// ─────────────────────────────────────────────────────────────────────────────
// LOGGED-IN USER (caregiver)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CAREGIVER: UsersRow = {
  id: 'user-001',
  email: 'prontip@pillo.care',
  name: 'พรทิพย์ สุขใจ',
  phone: '081-234-5678',
  role: 'nurse',
  ward_id: 'ward-1',
  created_at: '2025-01-15T07:00:00.000Z',
}

export const MOCK_WARD_CAREGIVERS: UsersRow[] = [
  {
    id: 'user-002',
    email: 'somying@pillo.care',
    name: 'สมหญิง ใจดี',
    phone: '081-555-0102',
    role: 'caregiver',
    ward_id: 'ward-1',
    created_at: '2025-02-01T07:00:00.000Z',
  },
  {
    id: 'user-003',
    email: 'wirat@pillo.care',
    name: 'วิรัตน์ ทองคำ',
    phone: '081-555-0103',
    role: 'nurse',
    ward_id: 'ward-1',
    created_at: '2025-02-10T07:00:00.000Z',
  },
  {
    id: 'user-004',
    email: 'malee@pillo.care',
    name: 'มาลี ศรีจันทร์',
    phone: '081-555-0104',
    role: 'caregiver',
    ward_id: 'ward-1',
    created_at: '2025-03-05T07:00:00.000Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// PATIENTS
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_PATIENTS: PatientsRow[] = [
  {
    id: 'pt-001',
    name: 'สมชาย รักไทย',
    date_of_birth: '1948-03-12',
    ward_id: 'ward-1',
    room_number: '101A',
    photo_url: null,
    status: 'active',
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'pt-002',
    name: 'มาลี สุขสันต์',
    date_of_birth: '1952-07-22',
    ward_id: 'ward-1',
    room_number: '101B',
    photo_url: null,
    status: 'active',
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'pt-003',
    name: 'ประยุทธ์ ใจดี',
    date_of_birth: '1944-11-05',
    ward_id: 'ward-1',
    room_number: '102A',
    photo_url: null,
    status: 'active',
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'pt-004',
    name: 'สมหญิง เจริญสุข',
    date_of_birth: '1950-05-15',
    ward_id: 'ward-1',
    room_number: '102B',
    photo_url: null,
    status: 'active',
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-03-01T00:00:00.000Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// MEDICINES (catalog used by the Add Medication picker)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_MEDICINES: MedicinesRow[] = [
  {
    id: 'med-001',
    name: 'แอมโลดิปีน / Amlodipine',
    category: 'Cardiovascular',
    dosage_form: 'เม็ด',
    strength: '5mg',
    description: 'Calcium channel blocker for hypertension',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-002',
    name: 'เมทฟอร์มิน / Metformin',
    category: 'Diabetes',
    dosage_form: 'เม็ด',
    strength: '500mg',
    description: 'First-line diabetes medication',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-003',
    name: 'แอสไพริน / Aspirin',
    category: 'Antiplatelet',
    dosage_form: 'เม็ด',
    strength: '81mg',
    description: 'Low-dose antiplatelet',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-004',
    name: 'เมโทโพรลอล / Metoprolol',
    category: 'Cardiovascular',
    dosage_form: 'เม็ด',
    strength: '25mg',
    description: 'Beta blocker',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-005',
    name: 'อีนาลาพริล / Enalapril',
    category: 'Cardiovascular',
    dosage_form: 'เม็ด',
    strength: '5mg',
    description: 'ACE inhibitor',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-006',
    name: 'ฟูโรซีไมด์ / Furosemide',
    category: 'Diuretic',
    dosage_form: 'เม็ด',
    strength: '40mg',
    description: 'Loop diuretic — monitor potassium',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-007',
    name: 'อะทอร์วาสแตติน / Atorvastatin',
    category: 'Lipid',
    dosage_form: 'เม็ด',
    strength: '10mg',
    description: 'Statin for cholesterol',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-008',
    name: 'เลโวไทรอกซิน / Levothyroxine',
    category: 'Thyroid',
    dosage_form: 'เม็ด',
    strength: '50mcg',
    description: 'Take on empty stomach',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-009',
    name: 'วอร์ฟาริน / Warfarin',
    category: 'Anticoagulant',
    dosage_form: 'เม็ด',
    strength: '2mg',
    description: 'Anticoagulant — monitor INR',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'med-010',
    name: 'พาราเซตามอล / Paracetamol',
    category: 'Analgesic',
    dosage_form: 'เม็ด',
    strength: '500mg',
    description: 'Pain and fever',
    side_effects: null,
    storage_instructions: null,
    created_at: '2025-01-01T00:00:00.000Z',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// PRESCRIPTION DETAIL (for patient detail screen)
// ─────────────────────────────────────────────────────────────────────────────

export type MockPrescriptionDetail = ScheduleItem

export const MOCK_PRESCRIPTIONS: MockPrescriptionDetail[] = [
  {
    prescription_id: 'rx-001',
    patient_id: 'pt-001',
    patient_name: 'สมชาย รักไทย',
    room_number: '101A',
    medicine_id: 'med-001',
    medicine_name: 'แอมโลดิปีน',
    medicine_strength: '5mg',
    dosage_form: 'เม็ด',
    dose_quantity: 1,
    meal_time: 'morning',
    status: 'confirmed',
    conflict_flag: false,
    log_id: 'log-001',
    notes: 'พร้อมอาหาร',
  },
  {
    prescription_id: 'rx-002',
    patient_id: 'pt-001',
    patient_name: 'สมชาย รักไทย',
    room_number: '101A',
    medicine_id: 'med-002',
    medicine_name: 'เมทฟอร์มิน',
    medicine_strength: '500mg',
    dosage_form: 'เม็ด',
    dose_quantity: 1,
    meal_time: 'morning',
    status: 'confirmed',
    conflict_flag: false,
    log_id: 'log-002',
    notes: 'หลังอาหาร',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S SCHEDULE (mixed statuses for realistic testing)
// ─────────────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ScheduleItem> & Pick<ScheduleItem, 'prescription_id' | 'patient_id' | 'patient_name' | 'medicine_name' | 'meal_time'>): ScheduleItem {
  return {
    room_number: null,
    medicine_id: `med-${overrides.medicine_name?.toLowerCase().replace(/\s/g, '-')}`,
    medicine_strength: null,
    dosage_form: 'เม็ด',
    dose_quantity: 1,
    notes: null,
    status: 'pending',
    conflict_flag: false,
    log_id: null,
    ...overrides,
  }
}

export const MOCK_SCHEDULE_GROUPS: ScheduleGroup[] = [
  // ─── 🌅 MORNING ───
  {
    meal_time: 'morning',
    label_th: 'เช้า',
    label_en: 'Morning',
    emoji: '🌅',
    items: [
      makeItem({
        prescription_id: 'sch-003', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'แอมโลดิปีน', medicine_strength: '5mg', meal_time: 'morning',
        notes: 'พร้อมอาหาร', status: 'confirmed', log_id: 'log-003',
      }),
      makeItem({
        prescription_id: 'sch-004', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'เมทฟอร์มิน', medicine_strength: '500mg', meal_time: 'morning',
        notes: 'หลังอาหาร', status: 'confirmed', log_id: 'log-004',
      }),
      makeItem({
        prescription_id: 'sch-005', patient_id: 'pt-002',
        patient_name: 'มาลี สุขสันต์', room_number: '101B',
        medicine_name: 'แอสไพริน', medicine_strength: '81mg', meal_time: 'morning',
        notes: 'หลังอาหาร', status: 'confirmed', log_id: 'log-005',
      }),
      makeItem({
        prescription_id: 'sch-006', patient_id: 'pt-002',
        patient_name: 'มาลี สุขสันต์', room_number: '101B',
        medicine_name: 'เมโทโพรลอล', medicine_strength: '25mg', meal_time: 'morning',
        status: 'confirmed', log_id: 'log-006',
      }),
      makeItem({
        prescription_id: 'sch-007', patient_id: 'pt-003',
        patient_name: 'ประยุทธ์ ใจดี', room_number: '102A',
        medicine_name: 'อีนาลาพริล', medicine_strength: '5mg', meal_time: 'morning',
        status: 'refused', log_id: 'log-007',
      }),
      makeItem({
        prescription_id: 'sch-008', patient_id: 'pt-003',
        patient_name: 'ประยุทธ์ ใจดี', room_number: '102A',
        medicine_name: 'ฟูโรซีไมด์', medicine_strength: '40mg', meal_time: 'morning',
        notes: '⚠️ ติดตาม K+', status: 'refused', log_id: 'log-008',
      }),
      makeItem({
        prescription_id: 'sch-009', patient_id: 'pt-004',
        patient_name: 'สมหญิง เจริญสุข', room_number: '102B',
        medicine_name: 'เมทฟอร์มิน', medicine_strength: '1000mg', dose_quantity: 2, meal_time: 'morning',
        notes: '📝 ขนาดยาเพิ่มจาก 500mg', status: 'confirmed', log_id: 'log-009',
      }),
    ],
  },

  // ─── ☀️ NOON ───
  {
    meal_time: 'noon',
    label_th: 'กลางวัน',
    label_en: 'Noon',
    emoji: '☀️',
    items: [
      makeItem({
        prescription_id: 'sch-011', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'เมทฟอร์มิน', medicine_strength: '500mg', meal_time: 'noon',
        notes: 'หลังอาหาร', status: 'pending',
      }),
      makeItem({
        prescription_id: 'sch-012', patient_id: 'pt-002',
        patient_name: 'มาลี สุขสันต์', room_number: '101B',
        medicine_name: 'เมโทโพรลอล', medicine_strength: '25mg', meal_time: 'noon',
        status: 'pending',
      }),
      makeItem({
        prescription_id: 'sch-013', patient_id: 'pt-004',
        patient_name: 'สมหญิง เจริญสุข', room_number: '102B',
        medicine_name: 'เมทฟอร์มิน', medicine_strength: '1000mg', dose_quantity: 2, meal_time: 'noon',
        status: 'pending', conflict_flag: true,
      }),
    ],
  },

  // ─── 🌆 EVENING ───
  {
    meal_time: 'evening',
    label_th: 'เย็น',
    label_en: 'Evening',
    emoji: '🌆',
    items: [
      makeItem({
        prescription_id: 'sch-014', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'แอมโลดิปีน', medicine_strength: '5mg', meal_time: 'evening',
        status: 'pending',
      }),
      makeItem({
        prescription_id: 'sch-015', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'เมทฟอร์มิน', medicine_strength: '500mg', meal_time: 'evening',
        notes: 'หลังอาหาร', status: 'pending',
      }),
      makeItem({
        prescription_id: 'sch-016', patient_id: 'pt-002',
        patient_name: 'มาลี สุขสันต์', room_number: '101B',
        medicine_name: 'เมโทโพรลอล', medicine_strength: '25mg', meal_time: 'evening',
        status: 'pending',
      }),
    ],
  },

  // ─── 🌙 BEDTIME ───
  {
    meal_time: 'bedtime',
    label_th: 'ก่อนนอน',
    label_en: 'Bedtime',
    emoji: '🌙',
    items: [
      makeItem({
        prescription_id: 'sch-018', patient_id: 'pt-001',
        patient_name: 'สมชาย รักไทย', room_number: '101A',
        medicine_name: 'อะทอร์วาสแตติน', medicine_strength: '10mg', meal_time: 'bedtime',
        status: 'pending',
      }),
      makeItem({
        prescription_id: 'sch-019', patient_id: 'pt-002',
        patient_name: 'มาลี สุขสันต์', room_number: '101B',
        medicine_name: 'แอสไพริน', medicine_strength: '81mg', meal_time: 'bedtime',
        status: 'pending',
      }),
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// STOCK ALERTS
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ACTIVE_ALERTS: AppAlert[] = [
  {
    id: 'alert-001',
    type: 'stock_critical',
    title_th: '🔴 ยาใกล้หมด — สมหญิง',
    body_th: 'เลโวไทรอกซิน เหลืออีก 3 วัน กรุณาแจ้งญาติมารับยาด่วน',
    severity: 'critical',
    patient_id: 'pt-004',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alert-002',
    type: 'stock_warning',
    title_th: '⚠️ ยาใกล้หมด — สมชาย',
    body_th: 'วอร์ฟาริน เหลืออีก 6 วัน',
    severity: 'warning',
    patient_id: 'pt-001',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS LIST
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: NotificationLogsRow[] = [
  {
    id: 'notif-001',
    channel: 'push',
    status: 'delivered',
    recipient_type: 'caregiver',
    recipient_id: 'user-001',
    event_type: 'stock_critical',
    payload: { title: '🔴 ยาใกล้หมด — สมหญิง เจริญสุข', body: 'เลโวไทรอกซิน เหลืออีก 3 วัน' },
    sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-002',
    channel: 'push',
    status: 'delivered',
    recipient_type: 'caregiver',
    recipient_id: 'user-001',
    event_type: 'stock_warning',
    payload: { title: '⚠️ ยาใกล้หมด — สมชาย รักไทย', body: 'วอร์ฟาริน เหลืออีก 6 วัน' },
    sent_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT HANDOVER
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_HANDOVER = {
  id: 'handover-001',
  ward_id: 'ward-1',
  shift_start: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  shift_end: new Date().toISOString(),
  caregiver_id: 'user-002',
  acknowledged_at: null,
  created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  summary_json: {
    pending_medications: [
      {
        patient_name: 'ประยุทธ์ ใจดี',
        room_bed: '102A',
        medication_name: 'อีนาลาพริล (Enalapril 5mg)',
        meal_period: 'เช้า',
      },
      {
        patient_name: 'ประยุทธ์ ใจดี',
        room_bed: '102A',
        medication_name: 'ฟูโรซีไมด์ (Furosemide 40mg)',
        meal_period: 'เช้า',
      },
    ],
    prescription_changes: [
      {
        patient_name: 'สมหญิง เจริญสุข',
        medication_name: 'เมทฟอร์มิน',
        change_type: 'เพิ่มขนาดยา',
        previous_value: { dosage: '500mg' },
        new_value: { dosage: '1000mg' },
      },
    ],
    prn_medications: [
      {
        patient_name: 'ประยุทธ์ ใจดี',
        medication_name: 'ไดอะซีแพม 2mg',
        administered_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        notes: 'PRN วิตกกังวล',
      },
    ],
    alerts: [
      '🔴 สมหญิง เจริญสุข — เลโวไทรอกซิน เหลืออีก 3 วัน ต้องแจ้งญาติด่วน',
    ],
  },
}

export const MOCK_HANDOVER_HISTORY = [
  {
    id: 'handover-h-001',
    ward_id: 'ward-1',
    caregiver_id: 'user-002',
    shift_start: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    shift_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    acknowledged_by_id: 'user-001',
    shift_notes: 'คุณสมชายปฏิเสธยา 12:00 — ติดตามมื้อเย็น',
    created_at: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    summary_json: { pending_medications: [], prescription_changes: [], prn_medications: [], alerts: [] },
  },
  {
    id: 'handover-h-002',
    ward_id: 'ward-1',
    caregiver_id: 'user-003',
    shift_start: new Date(Date.now() - 56 * 60 * 60 * 1000).toISOString(),
    shift_end: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
    acknowledged_by_id: 'user-002',
    shift_notes: null,
    created_at: new Date(Date.now() - 56 * 60 * 60 * 1000).toISOString(),
    summary_json: { pending_medications: [{ patient_name: 'ประยุทธ์ ใจดี', medication_name: 'อีนาลาพริล' }], prescription_changes: [], prn_medications: [], alerts: [] },
  },
  {
    id: 'handover-h-003',
    ward_id: 'ward-1',
    caregiver_id: 'user-001',
    shift_start: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
    shift_end: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 71 * 60 * 60 * 1000).toISOString(),
    acknowledged_by_id: 'user-003',
    shift_notes: 'ทุกอย่างเรียบร้อย',
    created_at: new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString(),
    summary_json: { pending_medications: [], prescription_changes: [], prn_medications: [], alerts: [] },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED COUNTS
// ─────────────────────────────────────────────────────────────────────────────

export function computeMockCounts() {
  const allItems = MOCK_SCHEDULE_GROUPS.flatMap((g) => g.items)
  return {
    pending: allItems.filter((i) => i.status === 'pending').length,
    completed: allItems.filter((i) => i.status === 'confirmed').length,
    refused: allItems.filter((i) => i.status === 'refused').length,
    total: allItems.length,
  }
}