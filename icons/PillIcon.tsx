import React from 'react'
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg'

export default function PillIcon({ width = 24, height = 24, color = '#505050' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id="clip_pill">
          <Rect width="24" height="24" fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip_pill)">
        <Path
          d="M4.50053 12.4996L12.5005 4.49955C13.4288 3.57129 14.6878 3.0498 16.0005 3.0498C17.3133 3.0498 18.5723 3.57129 19.5005 4.49955C20.4288 5.42781 20.9503 6.6868 20.9503 7.99955C20.9503 9.31231 20.4288 10.5713 19.5005 11.4996L11.5005 19.4996C10.5723 20.4278 9.31328 20.9493 8.00053 20.9493C6.68777 20.9493 5.42879 20.4278 4.50053 19.4996C3.57227 18.5713 3.05078 17.3123 3.05078 15.9996C3.05078 14.6868 3.57227 13.4278 4.50053 12.4996Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M8.5 8.5L15.5 15.5"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  )
}
