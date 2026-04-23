import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useAuthStore } from '../src/stores/authStore'
import { supabase } from '../src/lib/supabase'
import type { LogStatus } from '../src/types/database'

type ReportSummary = {
  confirmed: number
  refused: number
  skipped: number
  total: number
  patients: Array<{ id: string; name: string; count: number }>
}

const EMPTY_SUMMARY: ReportSummary = {
  confirmed: 0,
  refused: 0,
  skipped: 0,
  total: 0,
  patients: [],
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileDot, { backgroundColor: accent }]} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  )
}

export default function ReportScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReportSummary>(EMPTY_SUMMARY)

  useEffect(() => {
    let active = true

    ;(async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)

      const { data: logs } = await supabase
        .from('medication_logs')
        .select('patient_id, status')
        .eq('caregiver_id', user.id)
        .gte('administered_at', start.toISOString())
        .lte('administered_at', end.toISOString())

      const rows = (dataFrom(logs) ?? []) as Array<{ patient_id: string; status: LogStatus }>
      const byPatient = new Map<string, number>()
      let confirmed = 0
      let refused = 0
      let skipped = 0

      for (const row of rows) {
        byPatient.set(row.patient_id, (byPatient.get(row.patient_id) ?? 0) + 1)
        if (row.status === 'confirmed') confirmed += 1
        if (row.status === 'refused') refused += 1
        if (row.status === 'skipped') skipped += 1
      }

      const patientIds = Array.from(byPatient.keys())
      let nameMap = new Map<string, string>()

      if (patientIds.length > 0) {
        const { data: patients } = await supabase
          .from('patients')
          .select('id, name')
          .in('id', patientIds)

        nameMap = new Map((patients ?? []).map((patient) => [patient.id, patient.name]))
      }

      const patients = patientIds
        .map((id) => ({
          id,
          name: nameMap.get(id) ?? 'Unknown patient',
          count: byPatient.get(id) ?? 0,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 5)

      if (!active) return

      setSummary({
        confirmed,
        refused,
        skipped,
        total: rows.length,
        patients,
      })
      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [user?.id])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FFF7ED', '#FBD7A8', '#F3A449']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#2F2D2B" />
          </Pressable>
          <Text style={styles.heroTitle}>Dispensing Report</Text>
          <Text style={styles.heroSubtitle}>Today&apos;s activity summary.</Text>
        </LinearGradient>

        <View style={styles.panel}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#ED9A41" />
            </View>
          ) : (
            <>
              <Text style={styles.totalLabel}>Total actions today</Text>
              <Text style={styles.totalValue}>{summary.total}</Text>

              <View style={styles.tileRow}>
                <SummaryTile label="Confirmed" value={summary.confirmed} accent="#29C792" />
                <SummaryTile label="Refused" value={summary.refused} accent="#F36B63" />
                <SummaryTile label="Skipped" value={summary.skipped} accent="#F0B34A" />
              </View>

              <Text style={styles.listTitle}>Most active patients</Text>
              {summary.patients.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={28} color="#B8A08A" />
                  <Text style={styles.emptyText}>No dispensing activity recorded yet today.</Text>
                </View>
              ) : (
                summary.patients.map((patient) => (
                  <View key={patient.id} style={styles.listRow}>
                    <View style={styles.patientBadge}>
                      <Text style={styles.patientBadgeText}>
                        {patient.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.patientInfo}>
                      <Text numberOfLines={1} style={styles.patientName}>
                        {patient.name}
                      </Text>
                      <Text style={styles.patientMeta}>{patient.count} actions</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function dataFrom<T>(value: T | null): T | null {
  return value
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  content: {
    paddingBottom: 32,
  },
  hero: {
    minHeight: 210,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 28,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 22,
    color: '#5D554D',
  },
  panel: {
    marginTop: -18,
    marginHorizontal: 22,
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    shadowColor: '#8A6440',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  loadingState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: '#81786F',
  },
  totalValue: {
    marginTop: 6,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FBF8F3',
    padding: 14,
  },
  tileDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  tileValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  tileLabel: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: '#7B746C',
  },
  listTitle: {
    marginTop: 26,
    marginBottom: 12,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  emptyState: {
    minHeight: 136,
    borderRadius: 22,
    backgroundColor: '#FBF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    color: '#857E76',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E1DA',
  },
  patientBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5B15B',
    marginRight: 12,
  },
  patientBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2F2D2B',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#2F2D2B',
  },
  patientMeta: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 19,
    color: '#807970',
  },
})
