/**
 * src/components/shared/NetworkBanner.tsx
 * Workflow 14 — passive supabase health probe.
 * Pings the lightest-weight selectable table every PROBE_INTERVAL ms; if the
 * request fails (or never returns within the timeout) we surface a yellow
 * "Offline / connection lost" banner above the screen content.
 *
 * Skipped entirely in mock mode so that local-only sessions don't flash the
 * banner because there's no Supabase backend configured.
 */

import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { USE_MOCK } from '../../mocks'

const PROBE_INTERVAL_MS = 60_000
const PROBE_TIMEOUT_MS = 8_000
const FAILURE_THRESHOLD = 2

async function probeSupabase(): Promise<boolean> {
  return Promise.race<boolean>([
    (async () => {
      try {
        const { error } = await supabase.from('wards').select('id').limit(1)
        return !error
      } catch {
        return false
      }
    })(),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), PROBE_TIMEOUT_MS)),
  ])
}

export function NetworkBanner() {
  const [offline, setOffline] = useState(false)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  useEffect(() => {
    if (USE_MOCK) return
    let cancelled = false

    async function tick() {
      const ok = await probeSupabase()
      if (cancelled) return
      if (ok) {
        setConsecutiveFailures(0)
        setOffline(false)
      } else {
        setConsecutiveFailures((current) => {
          const next = current + 1
          if (next >= FAILURE_THRESHOLD) setOffline(true)
          return next
        })
      }
    }

    tick()
    const handle = setInterval(tick, PROBE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(handle)
    }
  }, [])

  if (!offline) return null

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="Connection lost. Showing cached data."
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE6CE',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F2A24B',
      }}
    >
      <Ionicons name="cloud-offline" size={16} color="#8E4B14" />
      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '600', color: '#8E4B14' }}>
        ขาดการเชื่อมต่อ — กำลังแสดงข้อมูลสำรอง / Offline — showing cached data
      </Text>
    </View>
  )
}
