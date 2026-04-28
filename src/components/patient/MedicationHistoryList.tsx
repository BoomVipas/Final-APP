import React from 'react'
import { Text, View } from 'react-native'
import { type MedicationHistoryEntry, buildMedicineName } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHistoryDateBucket(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const delta = Math.round((a - b) / 86400000)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatHistoryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ─── HistoryStatusPill ────────────────────────────────────────────────────────
// Confirmed (green) / Refused (red) / Skipped (grey)

function HistoryStatusPill({ status }: { status: MedicationHistoryEntry['status'] }) {
  const tone =
    status === 'confirmed' ? { bg: '#E6FBF5', fg: '#0FB38D', label: 'Confirmed' } :
    status === 'refused'   ? { bg: '#FDEEEF', fg: '#EF5D5D', label: 'Refused' }   :
                             { bg: '#F0F2F5', fg: '#687385', label: 'Skipped' }
  return (
    <View style={{ borderRadius: 999, backgroundColor: tone.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: tone.fg }}>{tone.label}</Text>
    </View>
  )
}

// ─── MedicationHistoryList ────────────────────────────────────────────────────
// Groups entries by date: Today / Yesterday / day-of-week

export function MedicationHistoryList({ entries }: { entries: MedicationHistoryEntry[] }) {
  const buckets = new Map<string, MedicationHistoryEntry[]>()
  for (const entry of entries) {
    const key = formatHistoryDateBucket(entry.administered_at)
    const existing = buckets.get(key) ?? []
    existing.push(entry)
    buckets.set(key, existing)
  }

  return (
    <View style={{ gap: 18 }}>
      {Array.from(buckets.entries()).map(([bucket, rows]) => (
        <View key={bucket} style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#7E8797', letterSpacing: 0.5 }}>
            {bucket.toUpperCase()}
          </Text>

          {rows.map((entry) => {
            const medicineLabel = buildMedicineName(entry.medicine_name, entry.medicine_strength)
            const methodLabel   = entry.method !== 'normal' ? ` · ${entry.method.replace('_', ' ')}` : ''
            const subline       = entry.refusal_reason ?? entry.notes ?? null

            return (
              <View
                key={entry.id}
                style={{ backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#D7CCBB', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 2 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#3A3938' }}>
                    {formatHistoryTime(entry.administered_at)} · {entry.meal_time}{methodLabel}
                  </Text>
                  <HistoryStatusPill status={entry.status} />
                </View>

                <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#2F2E2D' }} numberOfLines={1}>
                  {medicineLabel}
                </Text>

                {subline ? (
                  <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 17, color: '#7E8797' }}>{subline}</Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}
