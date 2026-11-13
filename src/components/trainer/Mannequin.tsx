import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from './r3f'
import { sample, type Pattern } from './poses'

const D = Math.PI / 180
const BODY = '#EFE6D3'
const JOINT = '#C8A96A'
const METAL = '#2A2520'

type G = THREE.Group | null
interface Rig {
  root: G; pelvis: G; spine: G; chest: G; neck: G
  hipL: G; hipR: G; kneeL: G; kneeR: G; ankleL: G; ankleR: G
  shL: G; shR: G; elL: G; elR: G
  // contact points
  heelL: G; heelR: G; toeL: G; toeR: G; handL: G; handR: G; head: G; pelvisPt: G; chestPt: G; kneePtL: G; kneePtR: G; elbowPtL: G; elbowPtR: G
  barbell: G; dbL: G; dbR: G; kb: G; bench: G; seat: G; bar: G; dipL: G; dipR: G
}

function Limb({ length, radius }: { length: number; radius: number }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 6, 12]} />
      <meshStandardMaterial color={BODY} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}
const Joint = ({ r = 0.045 }: { r?: number }) => (
  <mesh><sphereGeometry args={[r, 16, 12]} /><meshStandardMaterial color={JOINT} roughness={0.35} metalness={0.6} /></mesh>
)

/**
 * An original, faceless articulated mannequin. Joint angles come from the
 * pattern library and are applied every frame; the body is then grounded on
 * the floor, a bench, a seat or a bar depending on the movement.
 */
export function Mannequin({ pattern, speedRef, onPhase, playingRef }: {
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
          <mesh><capsuleGeometry args={[0.1, 0.12, 6, 12]} /><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
          <group ref={set('spine')} position={[0, 0.08, 0]}>
            <Joint r={0.05} />
            <group position={[0, 0.2, 0]} rotation={[Math.PI, 0, 0]}><Limb length={0.22} radius={0.085} /></group>
            <group ref={set('chest')} position={[0, 0.22, 0]}>
              <group ref={set('chestPt')} position={[0, 0.1, 0]} />
              <mesh position={[0, 0.13, 0]} scale={[1.55, 1, 0.9]}><capsuleGeometry args={[0.1, 0.1, 6, 12]} /><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
              <group ref={set('neck')} position={[0, 0.27, 0]}>
                <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.035, 0.04, 0.07, 12]} /><meshStandardMaterial color={BODY} /></mesh>
                <group ref={set('head')} position={[0, 0.15, 0]}>
                  <mesh scale={[0.9, 1.08, 0.95]}><sphereGeometry args={[0.105, 24, 18]} /><meshStandardMaterial color={BODY} roughness={0.5} /></mesh>
                  <mesh position={[0, 0.0, 0.085]} rotation={[0, 0, 0]}><sphereGeometry args={[0.03, 12, 8]} /><meshStandardMaterial color={JOINT} metalness={0.6} roughness={0.35} /></mesh>
                </group>
              </group>
              {(['L', 'R'] as const).map((s) => (
                <group key={s} ref={set(s === 'L' ? 'shL' : 'shR')} position={[s === 'L' ? 0.2 : -0.2, 0.22, 0]}>
                  <Joint r={0.05} />
                  <Limb length={0.28} radius={0.045} />
                  <group ref={set(s === 'L' ? 'elL' : 'elR')} position={[0, -0.29, 0]}>
                    <group ref={set(s === 'L' ? 'elbowPtL' : 'elbowPtR')} />
                    <Joint r={0.04} />
                    <Limb length={0.25} radius={0.038} />
                    <group ref={set(s === 'L' ? 'handL' : 'handR')} position={[0, -0.28, 0]}>
                      <mesh><sphereGeometry args={[0.045, 14, 10]} /><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
                    </group>
                  </group>
                </group>
              ))}
            </group>
          </group>
          {(['L', 'R'] as const).map((s) => (
            <group key={s} ref={set(s === 'L' ? 'hipL' : 'hipR')} position={[s === 'L' ? 0.095 : -0.095, -0.05, 0]}>
              <Joint r={0.055} />
              <Limb length={0.43} radius={0.065} />
              <group ref={set(s === 'L' ? 'kneeL' : 'kneeR')} position={[0, -0.44, 0]}>
                <group ref={set(s === 'L' ? 'kneePtL' : 'kneePtR')} position={[0, 0, 0.05]} />
                <Joint r={0.05} />
                <Limb length={0.41} radius={0.05} />
                <group ref={set(s === 'L' ? 'ankleL' : 'ankleR')} position={[0, -0.42, 0]}>
                  <mesh position={[0, -0.035, 0.055]}><boxGeometry args={[0.09, 0.07, 0.23]} /><meshStandardMaterial color={BODY} roughness={0.55} /></mesh>
                  <group ref={set(s === 'L' ? 'heelL' : 'heelR')} position={[0, -0.07, -0.05]} />
                  <group ref={set(s === 'L' ? 'toeL' : 'toeR')} position={[0, -0.07, 0.165]} />
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>

      {/* equipment (positioned every frame) */}
      <group ref={set('barbell')} visible={false}>
        <mesh><cylinderGeometry args={[0.014, 0.014, 1.6, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} /></mesh>
        {[-0.68, 0.68].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.2, 0.2, 0.05, 28]} /><meshStandardMaterial color={JOINT} metalness={0.5} roughness={0.35} /></mesh>)}
      </group>
      {(['dbL', 'dbR'] as const).map((k) => (
        <group key={k} ref={set(k)} visible={false}>
          <mesh><cylinderGeometry args={[0.015, 0.015, 0.2, 8]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh>
          {[-0.09, 0.09].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.055, 0.055, 0.05, 16]} /><meshStandardMaterial color={JOINT} metalness={0.5} roughness={0.35} /></mesh>)}
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
