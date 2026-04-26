import type { TextStyle } from 'react-native'

// ─── Color Palette ────────────────────────────────────────────────────────────

export const colors = {
  lightBeige:   '#FFF5E8',
  softOrange:   '#F2A24B',
  gentleAmber:  '#FF6A63',
  text:         '#2E2C2A',
  text2:        '#97928B',
  border:       '#EFE4D5',
} as const

export type ColorKey = keyof typeof colors

// ─── Type Scale ───────────────────────────────────────────────────────────────
// Each entry mirrors the Figma spec: fontSize / lineHeight

export const typo = {
  displayLarge:   { fontSize: 57, lineHeight: 64, fontWeight: '600' },
  displayMedium:  { fontSize: 45, lineHeight: 52, fontWeight: '600' },
  displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '600' },

  headlineLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '600' },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
  headlineSmall:  { fontSize: 24, lineHeight: 32, fontWeight: '600' },

  titleLarge:     { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },

  labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '700' },

  bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySmall:      { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} satisfies Record<string, TextStyle>

export type TypoKey = keyof typeof typo
