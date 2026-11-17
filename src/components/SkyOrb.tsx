import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { gustPath, gustReach, type Gust } from '../lib/gust'

export type OrbMode = 'idle' | 'thinking' | 'speaking' | 'listening'

/** The gusts in the orb: how high up each blows (0 top to 1 bottom), how long it is against the orb, which way its hook curls, and whether it is far off. */
const GUSTS = [
  { lane: 0.22, length: 0.56, up: true, far: false },
  { lane: 0.5, length: 0.68, up: true, far: false },
  { lane: 0.76, length: 0.54, up: false, far: false },
  { lane: 0.36, length: 0.36, up: false, far: true },
  { lane: 0.63, length: 0.4, up: true, far: true },
  { lane: 0.88, length: 0.32, up: false, far: true },
  { lane: 0.1, length: 0.3, up: true, far: true },
]

/** How hard the wind blows in each mode: it calms to listen and picks up to think and to speak. */
const WIND: Record<OrbMode, number> = { idle: 1, listening: 0.55, speaking: 1.9, thinking: 2.5 }

const between = (a: number, b: number) => a + Math.random() * (b - a)
const ease = Easing.inOut(Easing.sin)

/** One gust on its way across: its shape, where its tail is, and how fast it is going. */
interface Flying { shape: Gust; x: number; y: number; speed: number }

/** A gust for this crossing: a little different every time. `spread` places it part of the way across to begin with. */
function launch(index: number, size: number, spread?: number): Flying {
  const g = GUSTS[index]
  const scale = between(0.88, 1.14)
  const shape: Gust = {
    length: size * g.length * scale,
    width: size * (g.far ? 0.026 : 0.046) * scale,
    hook: size * (g.far ? 0.04 : 0.066) * scale,
    turn: (g.up ? 1 : -1) * between(3.2, 3.9),
    bend: between(0.1, 0.2),
    ripples: between(0.8, 1.5),
    phase: between(0, Math.PI * 2),
  }
  const start = -gustReach(shape)
  return {
    shape,
    x: spread === undefined ? start : start + (size - start) * spread,
    y: size * (g.lane + between(-0.06, 0.06)),
    // orb widths a second; far gusts are slower
    speed: size * between(0.2, 0.36) * (g.far ? 0.55 : 1),
  }
}

/**
 * Breeze's face: the app icon come to life. A round of clear blue with gusts
 * of wind blowing through it, and a mind of its own. The gusts are drawn
 * afresh every frame, so each one ripples along its length and its hook curls
 * and uncurls as it blows across; every crossing is a new gust; the wind keeps
 * changing direction; and the whole orb drifts about and now and then perks
 * up. It also says what is happening in a conversation: it calms and holds
 * still to listen and swells with the user's voice, whirls round while Breeze
 * is thinking, and blows hard and pulses while Breeze speaks.
 */
export function SkyOrb({ size = 240, mode = 'idle', level = 0 }: { size?: number; mode?: OrbMode; level?: number }) {
  const [pulse] = useState(() => new Animated.Value(0))
  const [voice] = useState(() => new Animated.Value(0))
  const [whirl] = useState(() => new Animated.Value(0))
  const [driftX] = useState(() => new Animated.Value(0))
  const [driftY] = useState(() => new Animated.Value(0))
  const [lean] = useState(() => new Animated.Value(0))
  const [perk] = useState(() => new Animated.Value(0))
  const [paths, setPaths] = useState<string[]>([])
  const wind = useRef(1)
  useEffect(() => { wind.current = WIND[mode] }, [mode])

  // the gusts: moved on and redrawn every frame
  useEffect(() => {
    const flying = GUSTS.map((_, i) => launch(i, size, (i * 0.37 + 0.15) % 1))
    let frame = 0
    let last = 0
    let time = 0
    let blowing = 1
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      // thirty redraws a second is smooth for wind and leaves the phone free for everything else
      if (last && now - last < 30) return
      const dt = last ? Math.min(0.06, (now - last) / 1000) : 0
      last = now
      // the wind picks up and dies down smoothly rather than all at once
      blowing += (wind.current - blowing) * Math.min(1, dt * 2.5)
      time += dt * (0.6 + 0.4 * blowing)
      setPaths(flying.map((f, i) => {
        f.x += f.speed * blowing * dt
        if (f.x > size * 1.05) flying[i] = f = launch(i, size)
        return gustPath(f.shape, f.x, f.y, time)
      }))
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [size])

  // it wanders: floats to a new spot and turns the wind a new way, again and again, never the same twice
  useEffect(() => {
    let alive = true
    let move: Animated.CompositeAnimation | undefined
    const still = mode === 'listening'
    const wander = () => {
      const ms = between(1800, 4200)
      const reach = size * (still ? 0.012 : 0.045)
      const to = (v: Animated.Value, toValue: number, duration = ms) => Animated.timing(v, { toValue, duration, easing: ease, useNativeDriver: true })
      const steps = [to(driftX, between(-reach, reach)), to(driftY, between(-reach, reach)), to(lean, still ? 0 : between(-1, 1))]
      // now and then it perks up, as if something caught its attention
      if (!still && Math.random() < 0.22) steps.push(Animated.sequence([to(perk, 1, 260), to(perk, 0, 620)]))
      move = Animated.parallel(steps)
      move.start(({ finished }) => { if (finished && alive) wander() })
    }
    wander()
    return () => { alive = false; move?.stop() }
  }, [mode, size, driftX, driftY, lean, perk])

  // the whole orb breathes: slowly at rest, deeper while thinking, quickly while speaking
  useEffect(() => {
    const half = mode === 'speaking' ? 380 : mode === 'thinking' ? 1300 : 2600
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: half, easing: ease, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [mode, pulse])

  // while thinking the wind turns in a circle; afterwards it finishes the turn and settles
  useEffect(() => {
    if (mode === 'thinking') {
      const spin = Animated.loop(Animated.timing(whirl, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }))
      spin.start()
      return () => spin.stop()
    }
    let settle: Animated.CompositeAnimation | undefined
    whirl.stopAnimation((at) => {
      if (!at) return
      settle = Animated.timing(whirl, { toValue: 1, duration: 900 * (1 - at) + 200, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      settle.start(({ finished }) => { if (finished) whirl.setValue(0) })
    })
    return () => settle?.stop()
  }, [mode, whirl])

  useEffect(() => {
    const move = Animated.spring(voice, { toValue: mode === 'listening' ? Math.min(1, level) : 0, useNativeDriver: true, speed: 26, bounciness: 4 })
    move.start()
    return () => move.stop()
  }, [level, mode, voice])

  const breath = mode === 'speaking' ? 0.05 : mode === 'thinking' ? 0.035 : 0.018
  const scale = Animated.add(
    Animated.add(pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + breath] }), perk.interpolate({ inputRange: [0, 1], outputRange: [0, 0.045] })),
    voice.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] }),
  )

  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', transform: [{ translateX: driftX }, { translateY: driftY }, { scale }] }}>
      <LinearGradient colors={['#00C8FF', '#068AFF', '#0060FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width: size, height: size }} />
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: whirl.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Animated.View style={{ width: size, height: size, transform: [{ rotate: lean.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] }) }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* far gusts first, so the near ones pass in front */}
            {GUSTS.map((g, i) => g.far && paths[i] ? <Path key={i} d={paths[i]} fill="#fff" opacity={0.34} /> : null)}
            {GUSTS.map((g, i) => !g.far && paths[i] ? <Path key={i} d={paths[i]} fill="#fff" /> : null)}
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}
