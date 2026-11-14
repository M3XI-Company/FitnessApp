import { useMemo, useRef } from 'react'
import { Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Canvas } from './r3f'
import { Mannequin } from './Mannequin'
import { GLBoundary } from './Trainer3D'
import { useStore } from '../../lib/store'
import { worksFor } from '../../data/exercises'
import { patternFor } from './poses'
import { C, G, T } from '../../theme'

const MAX_STEPS = 3

/**
 * Still pictures of correct form: the figure frozen at each key position of
 * the movement, side by side, with the cue for that position underneath.
 */
export function FormSteps({ exerciseId, height = 270 }: { exerciseId: string; height?: number }) {
  const pattern = useMemo(() => patternFor(exerciseId), [exerciseId])
  const { state } = useStore()
  const works = worksFor(exerciseId)
  // static figures still take the animation refs; they are never advanced
  const speedRef = useRef(1)
  const playingRef = useRef(false)

  // one picture per distinct key position (the last key usually returns to the first)
  const steps = useMemo(() => {
    const out: { at: number; label: string }[] = []
    let t = 0
    pattern.keys.forEach((key, i) => {
      const label = key.label ?? ''
      if (out.length < MAX_STEPS && !out.some((s) => s.label === label)) out.push({ at: t, label })
      t += pattern.seconds[i]
    })
    return out
  }, [pattern])

  const lying = pattern.ground === 'bench' || pattern.ground === 'all'
  const hang = pattern.ground === 'hang' && (pattern.hangHeight ?? 0) > 2
  const gap = pattern.load === 'barbell' ? 1.6 : lying ? 1.8 : 1.05
  const width = gap * steps.length
  const target = hang ? 1.2 : lying ? 0.6 : 0.9
  // far enough back that every figure fits across the picture
  const dist = Math.max(hang ? 5 : 3.3, width * (lying ? 1.2 : 0.86))

  return (
    <View style={{ borderRadius: 22, overflow: 'hidden' }}>
      <LinearGradient colors={G.night} style={{ height }}>
        <View style={{ flex: 1 }} pointerEvents="none">
          <GLBoundary>
            <Canvas camera={{ position: [0, target + 0.3, dist], fov: 34 }} gl={{ alpha: true, antialias: true }} onCreated={(s) => s.camera.lookAt(0, target, 0)}>
              <hemisphereLight args={['#FFF6EC', '#3A2E24', 0.55]} />
              <ambientLight intensity={0.3} />
              <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
              <directionalLight position={[-3, 2, -2]} intensity={0.55} color={C.skyLight} />
              {steps.map((s, i) => (
                <group key={`${exerciseId}-${i}`} position={[(i - (steps.length - 1) / 2) * gap, 0, 0]} rotation={[0, lying ? 1.15 : 0.6, 0]}>
                  <Mannequin pattern={pattern} at={s.at} speedRef={speedRef} playingRef={playingRef} works={works} female={state.profile.sex === 'female'} />
                </group>
              ))}
            </Canvas>
          </GLBoundary>
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 12 }}>
          {steps.map((s, i) => (
            <View key={s.label + i} style={{ flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.skyLight, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.night, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
              <Text style={[T.caption, { color: C.cloud, textAlign: 'center', fontWeight: '600' }]} numberOfLines={2}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  )
}
