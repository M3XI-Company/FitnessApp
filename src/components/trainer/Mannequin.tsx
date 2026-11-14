import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from './r3f'
import { sample, type Pattern } from './poses'

const D = Math.PI / 180
const METAL = '#1C3557'
const PLATE = '#5BB3EA'
const SHORTS = '#0F2440'
const HAIR = '#2B2118'
const SHOE = '#F7FBFF'
const SOLE = '#5BB3EA'
const MAIN = '#F2765A' // worked muscles (coral)
const ASSIST = '#FFB38A' // assisting muscles (peach)

/** Five skin tones for the figure */
export const SKIN_TONES = ['#F3D5C0', '#E4B896', '#C98F68', '#965F3F', '#5C3A26']

/** Slightly deeper version of a hex colour, for muscle definition */
const shade = (hex: string, f = 0.9) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')

type G = THREE.Group | null
interface Rig {
  root: G; pelvis: G; spine: G; chest: G; neck: G
  hipL: G; hipR: G; kneeL: G; kneeR: G; ankleL: G; ankleR: G
  shL: G; shR: G; elL: G; elR: G
  // contact points
  heelL: G; heelR: G; toeL: G; toeR: G; handL: G; handR: G; head: G; pelvisPt: G; chestPt: G; kneePtL: G; kneePtR: G; elbowPtL: G; elbowPtR: G
  barbell: G; dbL: G; dbR: G; kb: G; bench: G; seat: G; bar: G; dipL: G; dipR: G
}

const Skin = ({ tone }: { tone: string }) => <meshStandardMaterial color={tone} roughness={0.62} metalness={0} />

function Limb({ length, radius, tone }: { length: number; radius: number; tone: string }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 8, 16]} />
      <Skin tone={tone} />
    </mesh>
  )
}

export interface Works { primary: string[]; secondary: string[] }

/**
 * One anatomical muscle group, drawn as a sculpted ellipsoid over the limb.
 * Main movers glow coral, assisting muscles peach, the rest show natural definition.
 * `cover` hides an idle muscle under clothing (shorts, sports top).
 */
function Muscle({ slug, tone, works, position, scale, cover }: { slug: string; tone: string; works: Works; position: [number, number, number]; scale: [number, number, number]; cover?: string }) {
  const main = works.primary.includes(slug)
  const assist = !main && works.secondary.includes(slug)
  const color = main ? MAIN : assist ? ASSIST : cover ?? shade(tone)
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[1, 24, 18]} />
      <meshStandardMaterial color={color} roughness={main || assist ? 0.45 : cover ? 0.8 : 0.6} emissive={main ? MAIN : assist ? ASSIST : '#000000'} emissiveIntensity={main ? 0.35 : assist ? 0.15 : 0} />
    </mesh>
  )
}

/**
 * An original, faceless articulated mannequin. Joint angles come from the
 * pattern library and are applied every frame; the body is then grounded on
 * the floor, a bench, a seat or a bar depending on the movement.
 */
export function Mannequin({ pattern, speedRef, onPhase, playingRef, works = { primary: [], secondary: [] }, tone = SKIN_TONES[1], female = false }: {
  works?: Works
  tone?: string
  female?: boolean
  pattern: Pattern
  speedRef: MutableRefObject<number>
  playingRef: MutableRefObject<boolean>
  onPhase?: (label: string, phase: number) => void
}) {
  // a stable, mutable bag of scene-graph handles (filled by ref callbacks, read in useFrame)
  const r = useRef<Rig>({} as Rig).current
  const set = (k: keyof Rig) => (g: THREE.Group | null) => { r[k] = g }
  const time = useRef(0)
  const lastPhase = useRef(-1)
  const centerZ = useRef<number | null>(null)
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion() }), [])
  const sidePlane = pattern.elbowPlane === 'side'

  useFrame((_, delta) => {
    if (!r.root) return
    if (playingRef.current) time.current += Math.min(delta, 0.05) * speedRef.current
    const { pose, label, phase } = sample(pattern, time.current)
    if (phase !== lastPhase.current) { lastPhase.current = phase; onPhase?.(label, phase) }

    r.root.rotation.x = pose.pitch * D
    r.pelvis!.rotation.x = pose.pelvis * D
    r.spine!.rotation.x = pose.lean * D
    r.neck!.rotation.x = (pose.neck - pose.lean * 0.3) * D
    const flatten = pattern.ground === 'feet' || pattern.ground === 'seat'
    for (const s of ['L', 'R'] as const) {
      const side = pose[s]
      const sign = s === 'L' ? 1 : -1
      const hip = s === 'L' ? r.hipL! : r.hipR!
      const knee = s === 'L' ? r.kneeL! : r.kneeR!
      const ankle = s === 'L' ? r.ankleL! : r.ankleR!
      const sh = s === 'L' ? r.shL! : r.shR!
      const el = s === 'L' ? r.elL! : r.elR!
      hip.rotation.set(-side.hip * D, 0, sign * side.hipAbd * D)
      knee.rotation.x = side.knee * D
      const acc = (flatten ? pose.pitch : 0) + pose.pelvis - side.hip + side.knee
      ankle.rotation.x = (-acc + side.toe) * D
      sh.rotation.set(-side.shFlex * D, 0, sign * side.shAbd * D, 'XZY')
      // presses and pulls bend in the frontal plane; everything else in the sagittal plane
      if (sidePlane) el.rotation.set(0, 0, sign * side.elbow * D)
      else el.rotation.set(-side.elbow * D, 0, 0)
    }

    // ground the body
    r.root.position.set(0, 0, 0)
    r.root.updateMatrixWorld(true)
    const y = (g: G) => g!.getWorldPosition(v.a).y
    let offset = 0
    if (pattern.ground === 'feet') offset = -Math.min(y(r.heelL), y(r.heelR), y(r.toeL), y(r.toeR))
    else if (pattern.ground === 'hang') offset = (pattern.hangHeight ?? 2.2) - Math.max(y(r.handL), y(r.handR))
    else if (pattern.ground === 'seat') offset = 0.56 - y(r.pelvisPt)
    else if (pattern.ground === 'bench') offset = 0.56 - Math.min(y(r.pelvisPt), y(r.chestPt))
    else offset = -Math.min(y(r.heelL), y(r.heelR), y(r.toeL), y(r.toeR), y(r.handL), y(r.handR), y(r.kneePtL), y(r.kneePtR), y(r.elbowPtL), y(r.elbowPtR), y(r.head) - 0.11, y(r.pelvisPt) - 0.1, y(r.chestPt) - 0.1)
    // keep the figure centred on the turntable
    const zs = [r.heelL, r.toeR, r.handL, r.head, r.pelvisPt].map((g) => g!.getWorldPosition(v.a).z)
    const mid = (Math.min(...zs) + Math.max(...zs)) / 2
    centerZ.current = centerZ.current === null ? mid : centerZ.current + (mid - centerZ.current) * 0.08
    r.root.position.set(0, offset + pose.lift, -centerZ.current)
    r.root.updateMatrixWorld(true)

    // equipment follows the hands
    const hl = r.handL!.getWorldPosition(new THREE.Vector3())
    const hr = r.handR!.getWorldPosition(new THREE.Vector3())
    const parent = r.root.parent!
    parent.worldToLocal(hl); parent.worldToLocal(hr)
    const dir = v.b.copy(hl).sub(hr)
    const mid3 = hl.clone().add(hr).multiplyScalar(0.5)
    const len = dir.length()
    if (len > 0.0001) v.q.setFromUnitVectors(v.up, dir.clone().normalize())
    const show = (g: G, on: boolean) => { if (g) g.visible = on }
    show(r.barbell, pattern.load === 'barbell'); show(r.dbL, pattern.load === 'dumbbell'); show(r.dbR, pattern.load === 'dumbbell'); show(r.kb, pattern.load === 'kettlebell')
    if (pattern.load === 'barbell') { r.barbell!.position.copy(mid3); r.barbell!.quaternion.copy(v.q) }
    if (pattern.load === 'dumbbell') { r.dbL!.position.copy(hl); r.dbR!.position.copy(hr); r.dbL!.quaternion.copy(v.q); r.dbR!.quaternion.copy(v.q) }
    if (pattern.load === 'kettlebell') r.kb!.position.copy(mid3).add(new THREE.Vector3(0, -0.1, 0))

    // props
    show(r.bench, pattern.prop === 'bench'); show(r.seat, pattern.prop === 'seat'); show(r.bar, pattern.prop === 'bar'); show(r.dipL, pattern.prop === 'dipbars'); show(r.dipR, pattern.prop === 'dipbars')
    const pp = r.pelvisPt!.getWorldPosition(new THREE.Vector3()); parent.worldToLocal(pp)
    const cp = r.chestPt!.getWorldPosition(new THREE.Vector3()); parent.worldToLocal(cp)
    if (pattern.prop === 'bench') r.bench!.position.set(0, 0.235, (pp.z + cp.z) / 2 + (pattern.keys[0].pitch ?? 0) / 900)
    if (pattern.prop === 'seat') r.seat!.position.set(0, 0.24, pp.z - 0.02)
    if (pattern.prop === 'bar') r.bar!.position.set(0, (pattern.hangHeight ?? 2.2) + 0.02, mid3.z)
    if (pattern.prop === 'dipbars') { r.dipL!.position.set(hl.x, (pattern.hangHeight ?? 1.15) - 0.03, hl.z); r.dipR!.position.set(hr.x, (pattern.hangHeight ?? 1.15) - 0.03, hr.z) }
  })

  return (
    <group>
      <group ref={set('root')}>
        <group ref={set('pelvis')}>
          <group ref={set('pelvisPt')} />
          {/* hips and shorts */}
          <mesh scale={[female ? 1.08 : 1, 1, 0.92]}><capsuleGeometry args={[0.1, 0.1, 8, 16]} /><meshStandardMaterial color={SHORTS} roughness={0.8} /></mesh>
          {(['L', 'R'] as const).map((sd) => <Muscle key={sd} slug="gluteal" tone={tone} works={works} position={[sd === 'L' ? 0.065 : -0.065, -0.06, -0.07]} scale={[0.085, 0.09, 0.065]} cover={SHORTS} />)}
          <group ref={set('spine')} position={[0, 0.08, 0]}>
            {/* abdomen */}
            <mesh position={[0, 0.11, 0]} scale={[female ? 0.92 : 1, 1, 0.9]}><capsuleGeometry args={[0.088, 0.07, 8, 16]} /><Skin tone={tone} /></mesh>
            {[0.05, 0.1, 0.15].flatMap((y) => [-1, 1].map((sx) => <Muscle key={`abs${y}${sx}`} slug="abs" tone={tone} works={works} position={[sx * 0.028, y, 0.072]} scale={[0.026, 0.023, 0.016]} />))}
            {(['L', 'R'] as const).map((sd) => <Muscle key={`ob${sd}`} slug="obliques" tone={tone} works={works} position={[sd === 'L' ? 0.072 : -0.072, 0.1, 0.03]} scale={[0.028, 0.075, 0.05]} />)}
            {(['L', 'R'] as const).map((sd) => <Muscle key={`lb${sd}`} slug="lower-back" tone={tone} works={works} position={[sd === 'L' ? 0.032 : -0.032, 0.1, -0.068]} scale={[0.03, 0.08, 0.025]} />)}
            <group ref={set('chest')} position={[0, 0.22, 0]}>
              <group ref={set('chestPt')} position={[0, 0.1, 0]} />
              {/* ribcage (sports top for the female figure) */}
              <mesh position={[0, 0.13, 0]} scale={[female ? 1.4 : 1.55, 1, 0.88]}><capsuleGeometry args={[0.1, 0.1, 8, 16]} />{female ? <meshStandardMaterial color={SHORTS} roughness={0.8} /> : <Skin tone={tone} />}</mesh>
              {(['L', 'R'] as const).map((sd) => {
                const x = sd === 'L' ? 1 : -1
                return (
                  <group key={`torso${sd}`}>
                    <Muscle slug="chest" tone={tone} works={works} position={[x * 0.072, 0.17, 0.07]} scale={[0.082, 0.058, 0.035]} cover={female ? SHORTS : undefined} />
                    <Muscle slug="upper-back" tone={tone} works={works} position={[x * 0.095, 0.12, -0.055]} scale={[0.068, 0.13, 0.04]} cover={female ? SHORTS : undefined} />
                    <Muscle slug="trapezius" tone={tone} works={works} position={[x * 0.055, 0.255, -0.03]} scale={[0.07, 0.045, 0.045]} />
                  </group>
                )
              })}
              <group ref={set('neck')} position={[0, 0.27, 0]}>
                <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.042, 0.048, 0.09, 16]} /><Skin tone={tone} /></mesh>
                <group ref={set('head')} position={[0, 0.15, 0]}>
                  <mesh scale={[0.88, 1.08, 0.95]}><sphereGeometry args={[0.105, 32, 24]} /><Skin tone={tone} /></mesh>
                  {/* hair */}
                  <mesh position={[0, 0.03, -0.012]} scale={[0.93, 0.92, 0.98]}><sphereGeometry args={[0.108, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} /><meshStandardMaterial color={HAIR} roughness={0.9} /></mesh>
                  {female && <mesh position={[0, 0.0, -0.12]} scale={[0.8, 1.3, 0.8]}><sphereGeometry args={[0.04, 16, 12]} /><meshStandardMaterial color={HAIR} roughness={0.9} /></mesh>}
                  {[-1, 1].map((x) => <mesh key={x} position={[x * 0.09, -0.005, 0]} scale={[0.5, 1, 0.8]}><sphereGeometry args={[0.025, 12, 10]} /><Skin tone={tone} /></mesh>)}
                </group>
              </group>
              {(['L', 'R'] as const).map((sd) => (
                <group key={sd} ref={set(sd === 'L' ? 'shL' : 'shR')} position={[sd === 'L' ? (female ? 0.18 : 0.2) : (female ? -0.18 : -0.2), 0.22, 0]}>
                  <Muscle slug="deltoids" tone={tone} works={works} position={[0, -0.03, 0]} scale={[0.064, 0.072, 0.064]} />
                  <Limb length={0.28} radius={0.04} tone={tone} />
                  <Muscle slug="biceps" tone={tone} works={works} position={[0, -0.15, 0.028]} scale={[0.038, 0.088, 0.034]} />
                  <Muscle slug="triceps" tone={tone} works={works} position={[0, -0.14, -0.028]} scale={[0.04, 0.095, 0.035]} />
                  <group ref={set(sd === 'L' ? 'elL' : 'elR')} position={[0, -0.29, 0]}>
                    <group ref={set(sd === 'L' ? 'elbowPtL' : 'elbowPtR')} />
                    <mesh><sphereGeometry args={[0.038, 16, 12]} /><Skin tone={tone} /></mesh>
                    <Limb length={0.25} radius={0.033} tone={tone} />
                    <Muscle slug="forearm" tone={tone} works={works} position={[0, -0.08, 0.005]} scale={[0.042, 0.085, 0.04]} />
                    <group ref={set(sd === 'L' ? 'handL' : 'handR')} position={[0, -0.28, 0]}>
                      <mesh scale={[0.85, 1.2, 0.6]}><sphereGeometry args={[0.042, 16, 12]} /><Skin tone={tone} /></mesh>
                    </group>
                  </group>
                </group>
              ))}
            </group>
          </group>
          {(['L', 'R'] as const).map((sd) => {
            const inner = sd === 'L' ? -1 : 1
            return (
              <group key={sd} ref={set(sd === 'L' ? 'hipL' : 'hipR')} position={[sd === 'L' ? 0.095 : -0.095, -0.05, 0]}>
                {/* shorts leg */}
                <mesh position={[0, -0.09, 0]}><cylinderGeometry args={[0.078, 0.072, 0.2, 20]} /><meshStandardMaterial color={SHORTS} roughness={0.8} /></mesh>
                <Limb length={0.43} radius={0.06} tone={tone} />
                <Muscle slug="quadriceps" tone={tone} works={works} position={[0, -0.26, 0.032]} scale={[0.064, 0.15, 0.045]} />
                <Muscle slug="hamstring" tone={tone} works={works} position={[0, -0.26, -0.032]} scale={[0.058, 0.14, 0.045]} />
                <Muscle slug="adductors" tone={tone} works={works} position={[inner * 0.032, -0.22, 0]} scale={[0.035, 0.12, 0.042]} />
                <group ref={set(sd === 'L' ? 'kneeL' : 'kneeR')} position={[0, -0.44, 0]}>
                  <group ref={set(sd === 'L' ? 'kneePtL' : 'kneePtR')} position={[0, 0, 0.05]} />
                  <mesh><sphereGeometry args={[0.05, 16, 12]} /><Skin tone={tone} /></mesh>
                  <Limb length={0.41} radius={0.043} tone={tone} />
                  <Muscle slug="calves" tone={tone} works={works} position={[0, -0.13, -0.03]} scale={[0.047, 0.1, 0.042]} />
                  <Muscle slug="tibialis" tone={tone} works={works} position={[0, -0.17, 0.028]} scale={[0.026, 0.11, 0.025]} />
                  <group ref={set(sd === 'L' ? 'ankleL' : 'ankleR')} position={[0, -0.42, 0]}>
                    {/* trainers */}
                    <mesh position={[0, -0.035, 0.055]}><boxGeometry args={[0.09, 0.07, 0.23]} /><meshStandardMaterial color={SHOE} roughness={0.6} /></mesh>
                    <mesh position={[0, -0.068, 0.055]}><boxGeometry args={[0.094, 0.014, 0.235]} /><meshStandardMaterial color={SOLE} roughness={0.7} /></mesh>
                    <group ref={set(sd === 'L' ? 'heelL' : 'heelR')} position={[0, -0.07, -0.05]} />
                    <group ref={set(sd === 'L' ? 'toeL' : 'toeR')} position={[0, -0.07, 0.165]} />
                  </group>
                </group>
              </group>
            )
          })}
        </group>
      </group>

      {/* equipment (positioned every frame) */}
      <group ref={set('barbell')} visible={false}>
        <mesh><cylinderGeometry args={[0.014, 0.014, 1.6, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} /></mesh>
        {[-0.68, 0.68].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.2, 0.2, 0.05, 28]} /><meshStandardMaterial color={PLATE} metalness={0.3} roughness={0.4} /></mesh>)}
      </group>
      {(['dbL', 'dbR'] as const).map((k) => (
        <group key={k} ref={set(k)} visible={false}>
          <mesh><cylinderGeometry args={[0.015, 0.015, 0.2, 8]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh>
          {[-0.09, 0.09].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.055, 0.055, 0.05, 16]} /><meshStandardMaterial color={PLATE} metalness={0.3} roughness={0.4} /></mesh>)}
        </group>
      ))}
      <group ref={set('kb')} visible={false}>
        <mesh><sphereGeometry args={[0.1, 18, 14]} /><meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} /></mesh>
      </group>
      <group ref={set('bench')} visible={false}><mesh><boxGeometry args={[0.32, 0.47, 1.25]} /><meshStandardMaterial color="#3A332B" roughness={0.8} /></mesh></group>
      <group ref={set('seat')} visible={false}><mesh><boxGeometry args={[0.42, 0.48, 0.42]} /><meshStandardMaterial color="#3A332B" roughness={0.8} /></mesh></group>
      <group ref={set('bar')} visible={false}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 1.3, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh></group>
      {(['dipL', 'dipR'] as const).map((k) => (
        <group key={k} ref={set(k)} visible={false}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.9, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh></group>
      ))}
    </group>
  )
}
