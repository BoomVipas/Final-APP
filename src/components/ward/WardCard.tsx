import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../ui/Card'
import WardHospitalIcon from 'icons/WardHospitalIcon'
import { type WardSummaryCard } from './types'

// ─── StatBox ──────────────────────────────────────────────────────────────────
// One number + label cell inside a WardCard

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <LinearGradient
      colors={['#F1F1F1', '#FFFFFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1, minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: '#ECE5DB', paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' }}
    >
      <Text className="text-[16px] leading-[20px] font-semibold text-[#33312F]">{value}</Text>
      <Text className="text-[14px] leading-[18px] text-[#7D8798] mt-1" numberOfLines={1}>
        {label}
      </Text>
    </LinearGradient>
  )
}

// ─── WardCard ─────────────────────────────────────────────────────────────────
// One ward row on the Ward overview screen

interface WardCardProps {
  ward: WardSummaryCard
  onPress: () => void
}

export function WardCard({ ward, onPress }: WardCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className="mb-5">
      <Card className="bg-white shadow-sm px-4 py-4">
        <View className="flex-row items-start">
          <View className="w-16 h-16 rounded-[14px] bg-[#FFF5E8] overflow-hidden mr-4 items-center justify-center">
            <WardHospitalIcon width={64} height={64} />
          </View>

          <View className="flex-1 pr-8">
            <View className="flex-row items-center">
              <Text className="text-[18px] leading-[22px] font-bold text-[#343230]">{ward.title}</Text>
              {ward.lowStockCount > 0 ? (
                <View style={{ marginLeft: 8, minHeight: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: '#FBE4E1', flexDirection: 'row', alignItems: 'center' }}
                  accessibilityLabel={`${ward.lowStockCount} patients with low stock`}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#A3322A', marginRight: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#A3322A' }}>{ward.lowStockCount} low</Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center mt-2">
              <Ionicons name="layers-outline" size={17} color="#8A91A1" />
              <Text className="text-[14px] leading-[18px] text-[#7D8798] ml-2 flex-1">{ward.subtitle}</Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="time-outline" size={17} color="#8A91A1" />
              <Text className="text-[14px] leading-[18px] text-[#7D8798] ml-2">{ward.doseLabel}</Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="cube-outline" size={17} color="#8A91A1" />
              <Text className="text-[14px] leading-[18px] text-[#7D8798] ml-2">
                Filled {ward.fillCompletionLabel}{ward.fillCompletionLabel === '—' ? ' (no slot data)' : ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity className="min-h-[30px] min-w-[26px] items-center justify-center absolute right-1 top-0">
            <Ionicons name="ellipsis-vertical" size={18} color="#4C4845" />
          </TouchableOpacity>
        </View>

        <View className="h-px bg-[#ECE4DA] mt-5 mb-4" />

        <View className="flex-row">
          <StatBox value={ward.patientCount} label="Patients" />
          <View className="w-3" />
          <StatBox value={ward.successCount} label="Successfully" />
          <View className="w-3" />
          <StatBox value={ward.pendingCount} label="Pending" />
        </View>
      </Card>
    </TouchableOpacity>
  )
}
