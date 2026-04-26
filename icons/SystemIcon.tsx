import React from 'react'
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg'

export default function SystemIcon({ width = 20, height = 20, color = '#2E2E2E' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Defs>
        <ClipPath id="clip0_2164_84">
          <Rect width="20" height="20" fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip0_2164_84)">
        <Path
          d="M3.33337 5.83334C3.33337 5.39131 3.50897 4.96739 3.82153 4.65483C4.13409 4.34227 4.55801 4.16667 5.00004 4.16667H15C15.4421 4.16667 15.866 4.34227 16.1786 4.65483C16.4911 4.96739 16.6667 5.39131 16.6667 5.83334V15.8333C16.6667 16.2754 16.4911 16.6993 16.1786 17.0118C15.866 17.3244 15.4421 17.5 15 17.5H5.00004C4.55801 17.5 4.13409 17.3244 3.82153 17.0118C3.50897 16.6993 3.33337 16.2754 3.33337 15.8333V5.83334Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M13.3334 2.5V5.83333"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M6.66663 2.5V5.83333"
          stroke={color}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3.33337 9.16667H16.6667"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  )
}
