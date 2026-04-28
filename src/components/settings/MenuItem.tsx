import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// ─── MenuItem ─────────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  onPress: () => void
}

export function MenuItem({ icon, label, onPress }: MenuItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color="#32302F" />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#403D3C" />
    </Pressable>
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function MenuDivider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  label: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#2F2D2B',
    fontWeight: '400',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#97928B',
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E1DB',
    marginLeft: 16,
  },
})
