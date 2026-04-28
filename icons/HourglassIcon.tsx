import React from 'react'
import Svg, { Path } from 'react-native-svg'

export default function HourglassIcon({ width = 20, height = 20, color = '#505050' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Path
        d="M2.91669 1.66666H17.0834"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2.91669 18.3333H17.0834"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.58331 18.3333C5.69444 12.7755 7.49998 9.99767 9.99998 10C12.5 10.0023 14.3055 12.7801 15.4166 18.3333H4.58331Z"
        stroke={color}
        strokeLinejoin="round"
      />
      <Path
        d="M15.4166 1.66666C14.3055 7.22454 12.5 10.0023 9.99998 10C7.49998 9.99766 5.69444 7.21991 4.58331 1.66666H15.4166Z"
        stroke={color}
        strokeLinejoin="round"
      />
      <Path
        d="M8.75 6.25H11.25"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
