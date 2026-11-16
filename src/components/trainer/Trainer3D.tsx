import { Component, useMemo, useRef, useState, type ReactNode } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type * as THREE from 'three'
import { Canvas, useFrame } from './r3f'
import { Mannequin } from './Mannequin'
import { useStore } from '../../lib/store'
import { worksFor } from '../../data/exercises'
import { patternFor } from './poses'
import { C, G } from '../../theme'
import { Icon, tap } from '../ui'

export class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <View style={st.fallback}><Text style={{ color: C.cloud }}>3D isn&apos;t available on this device.</Text></View>
    return this.props.children
  }
}

const VIEWS = [{ label: 'Front', yaw: 0 }, { label: '¾', yaw: 0.65 }, { label: 'Side', yaw: Math.PI / 2 }]

// orbit limits: pitch is the camera's elevation above the figure's centre (radians)
const PITCH_MIN = -0.12
const PITCH_MAX = 1.35
const PITCH_DEFAULT = 0.1
const ZOOM_MIN = 0.55
const ZOOM_MAX = 1.6
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

interface View3D { yaw: number; pitch: number; zoom: number }

/**
 * Orbit camera: the turntable spins for yaw (so the key light stays put),
 * the camera rises/falls for pitch and moves in/out for zoom. Targets are set
 * by gestures; this eases toward them every frame without re-rendering React.
 */
function Orbit({ view, target, dist, children }: { view: View3D; target: number; dist: number; children: ReactNode }) {
  const grp = useRef<THREE.Group>(null)
  const cur = useRef({ ...view })
  useFrame((state, delta) => {
    const c = cur.current
    const k = Math.min(1, delta * 12)
    c.yaw += (view.yaw - c.yaw) * k
    c.pitch += (view.pitch - c.pitch) * k
    c.zoom += (view.zoom - c.zoom) * k
    if (grp.current) grp.current.rotation.y = c.yaw
    const d = dist * c.zoom
    state.camera.position.set(0, target + Math.sin(c.pitch) * d, Math.cos(c.pitch) * d)
    state.camera.lookAt(0, target, 0)
  })
  return <group ref={grp}>{children}</group>
}

/** Interactive 3D demonstration: drag to orbit, pinch to zoom, choose a view, change speed, pause. */
export function Trainer3D({ exerciseId, height = 340 }: { exerciseId: string; height?: number }) {
  const pattern = useMemo(() => patternFor(exerciseId), [exerciseId])
  const { state } = useStore()
  const works = worksFor(exerciseId)
  const hang = pattern.ground === 'hang' && (pattern.hangHeight ?? 0) > 2
  const speedRef = useRef(1)
  const playingRef = useRef(true)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [label, setLabel] = useState(pattern.keys[1]?.label ?? '')
  // gesture targets, read by <Orbit> every frame (mutated in place, no re-render)
  const view = useRef<View3D>({ yaw: 0.65, pitch: PITCH_DEFAULT, zoom: 1 }).current
  const start = useRef({ yaw: 0, pitch: 0, zoom: 1, pinch: 0 }).current
  const preset = (yaw: number) => {
    // turn the short way round to the preset, however far the user has spun
    view.yaw = yaw + Math.PI * 2 * Math.round((view.yaw - yaw) / (Math.PI * 2))
    view.pitch = PITCH_DEFAULT
    view.zoom = 1
  }

  // gesture callbacks run on touch events, never during render
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    // keep the gesture when the page's ScrollView asks for it
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.yaw = view.yaw; start.pitch = view.pitch; start.zoom = view.zoom; start.pinch = 0 },
    onPanResponderMove: (e, g) => {
      const t = e.nativeEvent.touches
      if (t.length >= 2) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY)
        if (!start.pinch) { start.pinch = d; start.zoom = view.zoom; return }
        view.zoom = clamp(start.zoom * (start.pinch / d), ZOOM_MIN, ZOOM_MAX)
        return
      }
      if (start.pinch) return // finger lifted after a pinch: ignore until release
      view.yaw = start.yaw + g.dx / 90
      view.pitch = clamp(start.pitch + g.dy / 140, PITCH_MIN, PITCH_MAX)
    },
  }), [view, start])
  const target = hang ? 1.2 : 0.85
  const dist = hang ? 4.61 : 3.47

  return (
    <View style={{ borderRadius: 24, overflow: 'hidden' }}>
      <LinearGradient colors={G.night} style={{ height }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GLBoundary>
            <Canvas shadows camera={{ position: [0, target + Math.sin(PITCH_DEFAULT) * dist, Math.cos(PITCH_DEFAULT) * dist], fov: 38 }} gl={{ alpha: true, antialias: true }} onCreated={(s) => s.camera.lookAt(0, target, 0)}>
              <hemisphereLight args={['#FFF6EC', '#3A2E24', 0.55]} />
              <ambientLight intensity={0.3} />
              <directionalLight position={[2.5, 4, 3]} intensity={1.6} castShadow />
              <directionalLight position={[-3, 2, -2]} intensity={0.55} color={C.skyLight} />
              <directionalLight position={[0, 1.5, -3.5]} intensity={0.45} />
              <Orbit view={view} target={target} dist={dist}>
                <Mannequin pattern={pattern} speedRef={speedRef} playingRef={playingRef} onPhase={(l) => setLabel(l)} works={works} female={state.profile.sex === 'female'} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                  <circleGeometry args={[1.25, 64]} /><meshStandardMaterial color="#1C3557" roughness={0.9} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
                  <ringGeometry args={[1.22, 1.25, 96]} /><meshBasicMaterial color={C.sky} />
                </mesh>
              </Orbit>
            </Canvas>
          </GLBoundary>
        </View>
        {/* drag surface */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} accessibilityLabel="3D trainer. Drag to orbit, pinch to zoom." />
        <View style={st.topRow} pointerEvents="box-none">
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={st.badge}><Icon name="sync-outline" size={13} color={C.skyLight} /><Text style={st.badgeText}>Drag to orbit</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {VIEWS.map((vw) => (
              <Pressable key={vw.label} onPress={() => { tap(); preset(vw.yaw) }} style={st.chip}><Text style={st.chipText}>{vw.label}</Text></Pressable>
            ))}
          </View>
        </View>
        <View style={st.bottom} pointerEvents="box-none">
          <Text style={st.phase} numberOfLines={1}>{label}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {[0.5, 1].map((s) => (
              <Pressable key={s} onPress={() => { tap(); speedRef.current = s; setSpeed(s) }} style={[st.chip, speed === s && { backgroundColor: C.sky }]}>
                <Text style={[st.chipText, speed === s && { color: C.night }]}>{s === 0.5 ? '½×' : '1×'}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={() => { tap(); playingRef.current = !playing; setPlaying(!playing) }} style={st.play}>
              <Icon name={playing ? 'pause' : 'play'} size={20} color={C.night} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

const st = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.08)' },
  badgeText: { color: C.skyLight, fontSize: 12, fontWeight: '600' },
  chip: { paddingHorizontal: 11, height: 30, borderRadius: 99, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.1)' },
  chipText: { color: C.cloud, fontSize: 13, fontWeight: '700' },
  bottom: { position: 'absolute', left: 14, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  phase: { flex: 1, color: C.cloud, fontWeight: '800', fontSize: 19 },
  play: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.skyLight, alignItems: 'center', justifyContent: 'center' },
})
