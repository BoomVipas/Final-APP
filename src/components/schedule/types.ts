export type AdminMethod = 'normal' | 'crushed' | 'feeding_tube'

export const METHOD_LABELS: Record<AdminMethod, string> = {
  normal:       'Normal',
  crushed:      'Crushed',
  feeding_tube: 'Feeding tube',
}

export type RefusalReason = 'patient_refused' | 'asleep' | 'vomiting' | 'npo' | 'other'

export const REFUSAL_REASONS: { value: RefusalReason; label_th: string; label_en: string }[] = [
  { value: 'patient_refused', label_th: 'ผู้ป่วยปฏิเสธ', label_en: 'Patient refused' },
  { value: 'asleep',          label_th: 'ผู้ป่วยหลับ',    label_en: 'Patient asleep' },
  { value: 'vomiting',        label_th: 'อาเจียน',       label_en: 'Vomiting' },
  { value: 'npo',             label_th: 'งดอาหารและยา', label_en: 'NPO (no food or meds)' },
  { value: 'other',           label_th: 'อื่นๆ',          label_en: 'Other' },
]
