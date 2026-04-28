import React from 'react'
import { Alert, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { scheduleRefillReminder } from '../../lib/notifications'
import HealthIcon from '../../../icons/Health.svg'
import { type DisplayMedication, DISPLAY_MEALS, MEAL_LABELS } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMedicationLabel(quantity: number, dosageForm: string | null): string {
  const unit = dosageForm?.toLowerCase().includes('tablet') ? 'tablet' : 'dose'
  return `${quantity} ${unit}${quantity === 1 ? '' : 's'}`
}

function parseScheduleLabel(notes: string | null): string | null {
  if (!notes) return null
  try {
    const p = JSON.parse(notes) as {
      schedule_type?: string
      frequency_hours?: number
      times_per_day?: number
      meal_relation?: string
      raw_frequency?: string
    }
    if (p.schedule_type === 'interval_hours' && p.frequency_hours)
      return p.frequency_hours === 24 ? 'Once per day' : `Every ${p.frequency_hours} hours`
    if (p.schedule_type === 'times_per_day' && p.times_per_day) {
      const n = p.times_per_day
      return n === 1 ? 'Once per day' : n === 2 ? 'Twice per day' : `${n}× per day`
    }
    if (p.schedule_type === 'meal_time' && p.meal_relation) {
      const map: Record<string, string> = { before: 'Before meals', after: 'After meals', with: 'With meals', any: 'With / without food' }
      return map[p.meal_relation] ?? 'With meals'
    }
    if (p.schedule_type === 'as_needed') return 'As needed (PRN)'
    return p.raw_frequency ?? null
  } catch {
    return notes
  }
}

// ─── MedicationChip ───────────────────────────────────────────────────────────
// Morning / Noon / Evening / Night pill — green when active

function MedicationChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={{ flex: 1, minHeight: 40, borderRadius: 10, borderWidth: active ? 2 : 1, borderColor: active ? '#16C7A4' : '#E5E5E5', backgroundColor: active ? '#DBF8F0' : '#F6F6F6', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: active ? '600' : '500', color: active ? '#15B896' : '#979797' }}>
        {label}
      </Text>
    </View>
  )
}

// ─── MedicationCard ───────────────────────────────────────────────────────────

interface MedicationCardProps {
  medication: DisplayMedication
  patientName: string
  onDiscontinue: (id: string, name: string) => void
  onRequestRefill: (medication: DisplayMedication) => void
}

export function MedicationCard({ medication, patientName, onDiscontinue, onRequestRefill }: MedicationCardProps) {
  const warningBg    = medication.warningTone === 'critical' ? '#FDEEEF' : '#FFF7E9'
  const warningColor = medication.warningTone === 'critical' ? '#EF5D5D' : '#F3A24D'
  const warningIcon  = medication.warningTone === 'critical' ? 'alert-circle' : 'warning'

  const stockPercent =
    medication.initialQuantity && medication.initialQuantity > 0 && medication.quantityRemaining != null
      ? Math.max(0, Math.min(1, medication.quantityRemaining / medication.initialQuantity))
      : null
  const stockTone     = stockPercent === null ? 'unknown' : stockPercent <= 0.15 ? 'critical' : stockPercent <= 0.35 ? 'warning' : 'ok'
  const stockBarColor = stockTone === 'critical' ? '#EF5D5D' : stockTone === 'warning' ? '#F3A24D' : '#27B07A'

  const showActions = () => {
    Alert.alert(medication.medicineName, 'Choose an action for this medication.', [
      { text: 'Request refill', onPress: () => onRequestRefill(medication) },
      { text: 'Discontinue', style: 'destructive', onPress: () => onDiscontinue(medication.id, medication.medicineName) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleSetReminder = () => {
    const remindIn = Math.max((medication.daysLeft ?? 0) - 1, 1)
    Alert.alert('Set reminder', `Notify in ${remindIn} day(s) that ${medication.medicineName} is running low?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const id = await scheduleRefillReminder({ medicineName: medication.medicineName, daysFromNow: remindIn, patientName })
          if (id) {
            Alert.alert('Reminder set', `You'll be reminded in ${remindIn} day(s).`)
          } else {
            Alert.alert('Permission needed', 'Enable notifications in Settings to schedule reminders.')
          }
        },
      },
    ])
  }

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 14, shadowColor: '#D7CCBB', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 4 }}>

      {/* Name + dose info + ⋯ menu button */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#2F2E2D' }} numberOfLines={1}>
            {medication.medicineName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <HealthIcon width={13} height={13} color="#7E8797" />
            <Text style={{ marginLeft: 5, fontSize: 13, lineHeight: 18, color: '#727C8F' }}>
              {getMedicationLabel(medication.doseQuantity, medication.dosageForm)}
            </Text>
          </View>
          {(() => {
            const label = parseScheduleLabel(medication.instructions)
            return label ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <Ionicons name="time-outline" size={13} color="#7E8797" />
                <Text style={{ marginLeft: 5, fontSize: 13, lineHeight: 18, color: '#727C8F' }}>{label}</Text>
              </View>
            ) : null
          })()}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${medication.medicineName}`}
          onPress={showActions}
          hitSlop={8}
          style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: -2, marginRight: -4 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#4C4845" />
        </TouchableOpacity>
      </View>

      {/* Meal-time chips: Morning / Noon / Evening / Night */}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
        {DISPLAY_MEALS.map((m) => (
          <MedicationChip key={m} label={MEAL_LABELS[m]} active={medication.mealTimes.includes(m)} />
        ))}
      </View>

      {/* Stock progress bar */}
      {stockPercent !== null ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: '#7E8797', fontWeight: '600', letterSpacing: 0.5 }}>STOCK</Text>
            <Text style={{ fontSize: 11, color: stockBarColor, fontWeight: '700' }}>
              {medication.quantityRemaining} / {medication.initialQuantity}
              {stockTone === 'critical' ? '  ·  Refill soon' : ''}
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: '#F1ECE5', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(stockPercent * 100)}%`, height: '100%', backgroundColor: stockBarColor }} />
          </View>
        </View>
      ) : null}

      {/* Warning banner + Set Reminder button */}
      {medication.warningTone ? (
        <View style={{ marginTop: 12, borderRadius: 12, backgroundColor: warningBg, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={warningIcon} size={16} color={warningColor} />
              <Text style={{ marginLeft: 6, fontSize: 13, lineHeight: 18, fontWeight: '700', color: warningColor }}>
                {medication.daysLeft} days left{medication.endDateLabel ? ` · Ends on ${medication.endDateLabel}` : ''}
              </Text>
            </View>
            <Text style={{ marginTop: 3, marginLeft: 22, fontSize: 11, lineHeight: 15, color: '#6F7582' }}>
              Medication will run out before the next refill
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSetReminder}
            hitSlop={8}
            style={{ minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#E5E3DE', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3938' }}>Set Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : medication.daysLeft !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Ionicons name="time-outline" size={15} color="#2F2E2D" />
          <Text style={{ marginLeft: 6, fontSize: 13, lineHeight: 18, color: '#3A3938' }}>{medication.daysLeft} days left</Text>
        </View>
      ) : null}
    </View>
  )
}
