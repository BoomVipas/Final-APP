import React from 'react'
import Svg, { Path, Circle } from 'react-native-svg'

export default function AlarmClockIcon({ width = 24, height = 24, color = '#FF7A73' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="7" stroke={color} strokeWidth="1.5" />
      <Path
        d="M12 10v3l2 1.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 5L3.5 7M19 5l1.5 2"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  )
}
