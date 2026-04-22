/**
 * src/stores/notificationStore.ts
 * Zustand store for in-app notifications and stock alerts.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { NotificationLogsRow } from '../types/database'

export interface AppAlert {
  id: string
  type: 'stock_critical' | 'stock_warning' | 'missed_dose' | 'prescription_change' | 'duplicate_warning'
  title_th: string
  body_th: string
  severity: 'critical' | 'warning' | 'info'
  patient_id: string | null
  created_at: string
}

interface NotificationState {
  notifications: NotificationLogsRow[]
  unreadCount: number
  activeAlerts: AppAlert[]
  loading: boolean
  error: string | null
  fetchNotifications: (caregiverId: string) => Promise<void>
  clearError: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  activeAlerts: [],
  loading: false,
  error: null,

  fetchNotifications: async (caregiverId: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('id, recipient_type, recipient_id, channel, event_type, payload, status, sent_at')
        .eq('recipient_type', 'caregiver')
        .eq('recipient_id', caregiverId)
        .order('sent_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const notifications = (data ?? []) as NotificationLogsRow[]

      const alerts: AppAlert[] = notifications
        .filter((n) => {
          const p = n.payload as Record<string, unknown>
          return p?.alert_type !== undefined
        })
        .slice(0, 10)
        .map((n) => {
          const p = n.payload as Record<string, unknown>
          return {
            id: n.id,
            type: (p.alert_type as AppAlert['type']) ?? 'missed_dose',
            title_th: (p.title_th as string) ?? 'แจ้งเตือน',
            body_th: (p.body_th as string) ?? '',
            severity: (p.severity as AppAlert['severity']) ?? 'info',
            patient_id: (p.patient_id as string) ?? null,
            created_at: n.sent_at,
          }
        })

      set({ notifications, unreadCount: notifications.filter((n) => n.status === 'sent').length, activeAlerts: alerts, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดการแจ้งเตือน'
      set({ error: message, loading: false })
    }
  },

  clearError: () => set({ error: null }),
}))