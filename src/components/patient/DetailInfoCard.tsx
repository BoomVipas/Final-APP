import React from 'react'
import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { type DetailPanelItem } from './types'

// Used by both the Appointments tab and the Device tab

export function DetailInfoCard({ item }: { item: DetailPanelItem }) {
  const badgeBg    = item.badgeTone === 'success' ? '#E6FBF5' : item.badgeTone === 'warning' ? '#FFF0DB' : '#F0F2F5'
  const badgeColor = item.badgeTone === 'success' ? '#0FB38D' : item.badgeTone === 'warning' ? '#E89A35' : '#687385'

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 18, shadowColor: '#D7CCBB', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 14 }, shadowRadius: 26, elevation: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Icon box */}
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF4E2', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Ionicons name={item.icon} size={22} color="#EFA247" />
        </View>

        {/* Text + badge */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#2F2E2D', flex: 1, paddingRight: 12 }}>
              {item.title}
            </Text>
            <View style={{ borderRadius: 999, backgroundColor: badgeBg, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: badgeColor }}>{item.badge}</Text>
            </View>
          </View>

          <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: '#727C8F' }}>{item.subtitle}</Text>
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: '#9AA2B1' }}>{item.meta}</Text>
        </View>
      </View>
    </View>
  )
}
