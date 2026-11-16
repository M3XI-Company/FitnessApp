import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

export type OrbMode = 'idle' | 'thinking' | 'speaking' | 'listening'

/** Soft clouds drawn by scripts/make-clouds.py; the image wraps left to right, so two copies slide forever without a seam. */
const CLOUDS = require('../../assets/clouds.png')

/**
 * Breeze's face: a round patch of sky with clouds drifting through it. It is
 * the only thing on screen in a conversation, so its movement says what is
 * happening: clouds drift slowly while idle, quicken and the sky breathes
 * while Breeze is thinking, it pulses gently while Breeze speaks, and it
 * swells with the user's voice while it listens.
 */
export function SkyOrb({ size = 240, mode = 'idle', level = 0 }: { size?: number; mode?: OrbMode; level?: number }) {
  const [drift] = useState(() => new Animated.Value(0))
  const [drift2] = useState(() => new Animated.Value(0))
  const [pulse] = useState(() => new Animated.Value(0))
  const [voice] = useState(() => new Animated.Value(0))

  // clouds drift right to left forever; faster while thinking
  useEffect(() => {
    const ms = mode === 'thinking' ? 9000 : mode === 'speaking' ? 14000 : 26000
    const run = (v: Animated.Value, factor: number) => {
      v.setValue(0)
      return Animated.loop(Animated.timing(v, { toValue: 1, duration: ms * factor, easing: Easing.linear, useNativeDriver: true }))
    }
    const a = run(drift, 1)
    const b = run(drift2, 1.6)
    a.start(); b.start()
    return () => { a.stop(); b.stop() }
  }, [mode, drift, drift2])

  // the whole orb breathes while thinking and pulses while speaking
  useEffect(() => {
    if (mode === 'idle' || mode === 'listening') { const rest = Animated.timing(pulse, { toValue: 0, duration: 300, useNativeDriver: true }); rest.start(); return () => rest.stop() }
    const half = mode === 'speaking' ? 380 : 1300
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [mode, pulse])

  useEffect(() => {
    const move = Animated.spring(voice, { toValue: mode === 'listening' ? Math.min(1, level) : 0, useNativeDriver: true, speed: 26, bounciness: 4 })
    move.start()
    return () => move.stop()
  }, [level, mode, voice])

  const scale = Animated.add(
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, mode === 'speaking' ? 1.05 : 1.03] }),
    voice.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }),
  )
  /** One layer of cloud: two copies of the texture side by side, sliding one width to the left and starting again. */
  const layer = (v: Animated.Value, scale: number, top: number, opacity: number) => {
    const w = size * 2 * scale
    return (
      <Animated.View style={{ position: 'absolute', left: 0, top: size * top, width: w * 2, height: w / 2, flexDirection: 'row', opacity, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -w] }) }] }}>
        {[0, 1].map((copy) => (
          <Animated.Image key={copy} source={CLOUDS} resizeMode="stretch" style={{ width: w, height: w / 2 }} />
        ))}
      </Animated.View>
    )
  }

  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', transform: [{ scale }] }}>
      <LinearGradient colors={['#3D6FE6', '#5C8DF0', '#A9C3F7', '#C7D7FA']} locations={[0, 0.35, 0.7, 1]} style={{ position: 'absolute', width: size, height: size }} />
      {layer(drift2, 1.5, -0.36, 0.5)}
      {layer(drift, 1, 0.02, 1)}
    </Animated.View>
  )
}
