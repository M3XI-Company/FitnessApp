import { Component, useMemo, useRef, useState, type ReactNode } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Canvas } from './r3f'
import { Mannequin } from './Mannequin'
import { patternFor } from './poses'
import { C, F, G } from '../../theme'
import { Icon, tap } from '../ui'

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <View style={st.fallback}><Text style={{ color: C.cream }}>3D isn&apos;t available on this device.</Text></View>
    return this.props.children
  }
}

const VIEWS = [{ label: 'Front', yaw: 0 }, { label: '¾', yaw: 0.65 }, { label: 'Side', yaw: Math.PI / 2 }]

/** Interactive 3D demonstration: drag to rotate, choose a view, change speed, pause. */
export function Trainer3D({ exerciseId, height = 340 }: { exerciseId: string; height?: number }) {
  const pattern = useMemo(() => patternFor(exerciseId), [exerciseId])
  const hang = pattern.ground === 'hang' && (pattern.hangHeight ?? 0) > 2
  const speedRef = useRef(1)
  const playingRef = useRef(true)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [yaw, setYawState] = useState(0.65)
  const [label, setLabel] = useState(pattern.keys[1]?.label ?? '')
  const drag = useRef({ yaw: 0.65, start: 0 })
  const setYaw = (y: number) => { drag.current.yaw = y; setYawState(y) }

  // gesture callbacks run on touch events, never during render
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderGrant: () => { drag.current.start = drag.current.yaw },
    onPanResponderMove: (_, g) => { drag.current.yaw = drag.current.start + g.dx / 90; setYawState(drag.current.yaw) },
  }), [])

  return (
    <View style={{ borderRadius: 24, overflow: 'hidden' }}>
      <LinearGradient colors={G.ink} style={{ height }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <GLBoundary>
            <Canvas shadows camera={{ position: [0, hang ? 1.55 : 1.25, hang ? 5.0 : 4.1], fov: 38 }} gl={{ alpha: true, antialias: true }} onCreated={(s) => s.camera.lookAt(0, hang ? 1.2 : 0.85, 0)}>
              <ambientLight intensity={0.75} />
              <directionalLight position={[2.5, 4, 3]} intensity={1.6} castShadow />
              <directionalLight position={[-3, 2, -2]} intensity={0.5} color={C.goldLight} />
              <group rotation={[0, yaw, 0]}>
                <Mannequin pattern={pattern} speedRef={speedRef} playingRef={playingRef} onPhase={(l) => setLabel(l)} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
                  <circleGeometry args={[1.25, 64]} /><meshStandardMaterial color="#2A2520" roughness={0.9} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
                  <ringGeometry args={[1.22, 1.25, 96]} /><meshBasicMaterial color={C.gold} />
                </mesh>
              </group>
            </Canvas>
          </GLBoundary>
        </View>
        {/* drag surface */}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} accessibilityLabel="3D trainer. Drag to rotate." />
        <View style={st.topRow} pointerEvents="box-none">
          <View style={st.badge}><Icon name="sync-outline" size={13} color={C.goldLight} /><Text style={st.badgeText}>Drag to rotate</Text></View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {VIEWS.map((vw) => (
              <Pressable key={vw.label} onPress={() => { tap(); setYaw(vw.yaw) }} style={st.chip}><Text style={st.chipText}>{vw.label}</Text></Pressable>
            ))}
          </View>
        </View>
        <View style={st.bottom} pointerEvents="box-none">
          <Text style={st.phase} numberOfLines={1}>{label}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {[0.5, 1].map((s) => (
              <Pressable key={s} onPress={() => { tap(); speedRef.current = s; setSpeed(s) }} style={[st.chip, speed === s && { backgroundColor: C.gold }]}>
                <Text style={[st.chipText, speed === s && { color: C.ink }]}>{s === 0.5 ? '½×' : '1×'}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={() => { tap(); playingRef.current = !playing; setPlaying(!playing) }} style={st.play}>
              <Icon name={playing ? 'pause' : 'play'} size={20} color={C.ink} />
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
  badgeText: { color: C.goldLight, fontSize: 12, fontWeight: '600' },
  chip: { paddingHorizontal: 11, height: 30, borderRadius: 99, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.1)' },
  chipText: { color: C.cream, fontSize: 13, fontWeight: '700' },
  bottom: { position: 'absolute', left: 14, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  phase: { flex: 1, color: C.cream, fontFamily: F.hand, fontSize: 26 },
  play: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
})
