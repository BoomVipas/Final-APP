export interface AlertCardData {
  id: string
  patientName: string
  title: string
  medication: string
  detail: string
  footnote: string
  cta: string
  ctaTone: 'danger' | 'warning'
}

export interface DispensePatientCard {
  id: string
  name: string
  room: string
  age: string
  wardId: string
  ward: string
  tablets: string
  statusLabel: string
  statusTone: 'urgent' | 'pending' | 'done'
  tags: string[]
  note?: string
  moreCount?: number
}

export interface WardFilterOption {
  id: string
  label: string
  patientCount: number
}
