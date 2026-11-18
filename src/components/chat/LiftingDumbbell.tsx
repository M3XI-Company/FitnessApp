import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { C } from '../../theme'

/**
 * A small dumbbell being lifted and lowered, shown while Breeze is working on
 * a reply: up quickly, down under control, the way a rep should go.
 */
export function LiftingDumbbell({ size = 22, color = C.accent }: { size?: number; color?: string }) {
  const [lift] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const rep = Animated.loop(Animated.sequence([
      Animated.timing(lift, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(lift, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(160),
    ]))
    rep.start()
    return () => rep.stop()
  }, [lift])
  const y = lift.interpolate({ inputRange: [0, 1], outputRange: [size * 0.2, -size * 0.2] })
  const plate = (tall: number) => <View style={{ width: size * 0.13, height: size * tall, borderRadius: size * 0.05, backgroundColor: color, marginHorizontal: size * 0.02 }} />
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size * 1.25, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', transform: [{ translateY: y }] }}>
        {plate(0.62)}{plate(0.42)}
        <View style={{ width: size * 0.42, height: size * 0.11, borderRadius: size * 0.05, backgroundColor: color }} />
        {plate(0.42)}{plate(0.62)}
      </Animated.View>
    </View>
  )
}
