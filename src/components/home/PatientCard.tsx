import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PatientAvatar } from '../shared/PatientAvatar'
import { type DispensePatientCard } from './types'

// ─── StatusChip ───────────────────────────────────────────────────────────────

function StatusChip({ label, tone }: { label: string; tone: DispensePatientCard['statusTone'] }) {
  const toneClass =
    tone === 'urgent'  ? 'bg-[#FFF1F3] text-[#FF6B6B]' :
    tone === 'pending' ? 'bg-[#FFF5E6] text-[#F0A13C]' :
                         'bg-[#E9FBF3] text-[#24B57A]'
  return (
    <View className={`rounded-full px-2.5 py-1 ${toneClass}`}>
      <Text className="text-[11px] font-medium">{label}</Text>
    </View>
  )
}

// ─── MedicationTag ────────────────────────────────────────────────────────────

function MedicationTag({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View
      className={`rounded-[10px] border px-2 py-1.5 mr-1.5 ${accent ? 'border-[#FF8E84] bg-[#FFF9F9]' : 'border-[#ECE7DF] bg-white'}`}
      style={{ maxWidth: 126, flexShrink: 1 }}
    >
      <Text numberOfLines={1} className={`text-[10px] leading-[14px] ${accent ? 'text-[#FF6A63]' : 'text-[#454240]'}`}>
        • {label.replace(/^•\s*/, '').trim()}
      </Text>
    </View>
  )
}

// ─── PatientCard ──────────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: DispensePatientCard
  onPress: () => void
  onMorePress: () => void
}

export function PatientCard({ patient, onPress, onMorePress }: PatientCardProps) {
  const visibleTags   = patient.tags.slice(0, 3)
  const hiddenTagCount = Math.max(patient.tags.length - visibleTags.length, 0) + (patient.moreCount ?? 0)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="bg-white border border-[#EDE4D8] rounded-[18px] px-4 py-4 mb-3"
      style={{ shadowColor: '#A07840', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <View className="flex-row items-start">
        <PatientAvatar name={patient.name} size={48} className="mr-3" />

        <View className="flex-1 pr-2">
          <View className="flex-row items-start justify-between">
            <Text className="text-[14px] font-bold text-[#282420] flex-1 pr-2">{patient.name}</Text>
            <TouchableOpacity onPress={onMorePress} className="min-h-[32px] min-w-[24px] items-center justify-center">
              <Ionicons name="ellipsis-vertical" size={16} color="#4A4744" />
            </TouchableOpacity>
          </View>

          <Text className="text-[12px] text-[#7B7880] mt-0.5">
            {patient.room} • Age {patient.age} • {patient.ward}
          </Text>

          <View className="flex-row items-center mt-1.5">
            <Ionicons name="medkit-outline" size={13} color="#7B7880" />
            <Text className="text-[12px] text-[#7B7880] ml-1.5 mr-2">{patient.tablets}</Text>
            <StatusChip label={patient.statusLabel} tone={patient.statusTone} />
          </View>
        </View>
      </View>

      <View className="h-px bg-[#EDE7DF] my-3" />

      {patient.note ? <Text className="text-[12.5px] text-[#E05A4E] mb-2.5">{patient.note}</Text> : null}

      <View className="flex-row flex-wrap">
        {visibleTags.map((tag, index) => (
          <MedicationTag key={`${tag}-${index}`} label={tag} accent={index < 2 && patient.statusTone !== 'done'} />
        ))}
      </View>

      {hiddenTagCount ? <Text className="text-[12px] text-[#6B6560] mt-2">+{hiddenTagCount} more items</Text> : null}
    </TouchableOpacity>
  )
}
