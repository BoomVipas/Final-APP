// import React from 'react'
// import ProfileBackgroundSvg from './profileBg.svg'

// export default function ProfileBackground({
//   width = 393,
//   height = 205,
// }: {
//   width?: number
//   height?: number
// }) {
//   return <ProfileBackgroundSvg width={width} height={height} />
// }

import React from 'react'
import { View, StyleSheet } from 'react-native'
import ProfileBackgroundSvg from './profileBg.svg'

type ProfileBackgroundProps = {
  children?: React.ReactNode
  height?: number
}

export default function ProfileBackground({
  children,
  height = 205,
}: ProfileBackgroundProps) {
  return (
    <View style={[styles.container, { height }]}>
      <ProfileBackgroundSvg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
})