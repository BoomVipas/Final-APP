import React from 'react'
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg'

export default function Background({ width = 393, height = 340 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 393 340" fill="none">
      <Defs>
        <LinearGradient
          id="paint0_linear_2069_84"
          x1="196.5"
          y1="299.88"
          x2="196.5"
          y2="19.751"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#F2A65A" />
          <Stop offset="1" stopColor="#FBF0E3" />
        </LinearGradient>
      </Defs>
      <Rect width="393" height="340" fill="url(#paint0_linear_2069_84)" />
    </Svg>
  )
}
