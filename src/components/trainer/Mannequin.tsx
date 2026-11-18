import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from './r3f'
import { sample, type Pattern } from './poses'
import { BODY_MUSCLES, type BodyData } from './body/types'
import { MALE } from './body/male'
import { FEMALE } from './body/female'

const D = Math.PI / 180
// The look of the charts on gym equipment: a pale, glassy blue body with the
// working muscles glowing red and the helping ones orange, steel and black iron.
const METAL = '#AEB6C0'
const PLATE = '#1E2024'
const PROP = '#C9D3DE'
/** the body between the muscle panels */
const BODY = '#CFE3F3'
const LOOK = { idle: '#A6D0F0', assist: '#F08A24', main: '#E5352B' }

/** Five skin tones (kept for the profile setting; the anatomical figure itself is neutral) */
export const SKIN_TONES = ['#F3D5C0', '#E4B896', '#C98F68', '#965F3F', '#5C3A26']

export interface Works { primary: string[]; secondary: string[] }

type P = THREE.Object3D | null
interface Rig {
  root: P
  // contact points, carried by the skeleton
  heelL: P; heelR: P; toeL: P; toeR: P; handL: P; handR: P; head: P; pelvisPt: P; chestPt: P; kneePtL: P; kneePtR: P; elbowPtL: P; elbowPtR: P
  barbell: P; dbL: P; dbR: P; kb: P; bench: P; seat: P; bar: P; dipL: P; dipR: P
}

// ---------------------------------------------------------------------------
// Body: a skinned human mesh (Quaternius Universal Base Characters, CC0) baked
// by scripts/build-body.mjs. Every vertex carries a muscle id, which is turned
// into a vertex colour: cool blue at rest, amber when assisting, red when it is
// a main mover.
// ---------------------------------------------------------------------------

function bytes(b64: string) {
  const bin = globalThis.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Which driver joint each bone follows. `mix` blends toward a second joint (spine and neck curve). */
type Driver = 'pelvis' | 'spine' | 'neck' | 'hipL' | 'hipR' | 'kneeL' | 'kneeR' | 'ankleL' | 'ankleR' | 'shL' | 'shR' | 'elL' | 'elR'
interface Follow { a: Driver; b?: Driver; mix?: number }
const FOLLOW: Record<string, Follow> = {
  pelvis: { a: 'pelvis' },
  spine_01: { a: 'pelvis', b: 'spine', mix: 1 / 3 },
  spine_02: { a: 'pelvis', b: 'spine', mix: 2 / 3 },
  spine_03: { a: 'spine' },
  neck_01: { a: 'spine', b: 'neck', mix: 0.5 },
  Head: { a: 'neck' },
  upperarm_l: { a: 'shL' }, lowerarm_l: { a: 'elL' },
  upperarm_r: { a: 'shR' }, lowerarm_r: { a: 'elR' },
  thigh_l: { a: 'hipL' }, calf_l: { a: 'kneeL' }, foot_l: { a: 'ankleL' },
  thigh_r: { a: 'hipR' }, calf_r: { a: 'kneeR' }, foot_r: { a: 'ankleR' },
}
const DRIVERS: Driver[] = ['pelvis', 'spine', 'neck', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'shL', 'shR', 'elL', 'elR']

type Points = Pick<Rig, 'heelL' | 'heelR' | 'toeL' | 'toeR' | 'handL' | 'handR' | 'head' | 'pelvisPt' | 'chestPt' | 'kneePtL' | 'kneePtR' | 'elbowPtL' | 'elbowPtR'>

interface Body {
  mesh: THREE.SkinnedMesh
  bones: THREE.Bone[]
  parent: number[]
  /** rest local rotation of every bone (fingers already curled into a grip) */
  rest: THREE.Quaternion[]
  /** for driven bones: rotation from the driver joint's frame to the bone's frame */
  offset: (THREE.Quaternion | null)[]
  follow: (Follow | null)[]
  world: THREE.Quaternion[]
  muscle: Uint8Array
  points: Points
  dispose: () => void
}

function buildBody(data: BodyData): Body {
  const n = data.vertices
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(data.position).buffer as ArrayBuffer), 3))
  const n8 = new Int8Array(bytes(data.normal).buffer as ArrayBuffer)
  const normal = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) normal[i] = n8[i] / 127
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(data.index).buffer as ArrayBuffer), 1))
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(bytes(data.skinIndex)), 4))
  const w8 = bytes(data.skinWeight)
  const weight = new Float32Array(n * 4)
  for (let i = 0; i < n * 4; i++) weight[i] = w8[i] / 255
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4))
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))

  const bones = data.bones.map((b) => {
    const bone = new THREE.Bone()
    bone.name = b.n
    bone.position.fromArray(b.t)
    bone.quaternion.fromArray(b.q)
    return bone
  })
  const parent = data.bones.map((b) => b.p)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.02 })
  // a bright rim where the surface turns away, like glass, and a glow on the warm (working) muscles
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rimEdge = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);
      totalEmissiveRadiance += vec3(0.78, 0.9, 1.0) * rimEdge * 0.55;
      float warmth = clamp((vColor.r - vColor.b) * 1.4, 0.0, 1.0);
      totalEmissiveRadiance += vColor.rgb * warmth * 0.42;`)
  }
  const mesh = new THREE.SkinnedMesh(geo, material)
  bones.forEach((bone, i) => { if (parent[i] >= 0) bones[parent[i]].add(bone); else mesh.add(bone) })
  mesh.updateMatrixWorld(true)
  mesh.bind(new THREE.Skeleton(bones))
  mesh.frustumCulled = false
  mesh.castShadow = true

  // bind pose (a T-pose) in the mesh's own space
  const bindQ = bones.map((bone) => bone.getWorldQuaternion(new THREE.Quaternion()))
  const bindP = bones.map((bone) => bone.getWorldPosition(new THREE.Vector3()))
  const at = (name: string) => bones.findIndex((bone) => bone.name === name)

  // curl the fingers into a grip (about the front-back axis while the arms are out sideways)
  const rest = bones.map((bone) => bone.quaternion.clone())
  const zAxis = new THREE.Vector3(0, 0, 1)
  bones.forEach((bone, i) => {
    const m = /^(index|middle|ring|pinky|thumb)_0([123])_([lr])$/.exec(bone.name)
    if (!m) return
    const angle = (m[1] === 'thumb' ? 20 : m[2] === '1' ? 62 : 50) * D * (m[3] === 'l' ? -1 : 1)
    const curl = new THREE.Quaternion().setFromAxisAngle(zAxis, angle)
    // the same world-space turn, expressed in this bone's own frame
    rest[i].multiply(bindQ[i].clone().invert().multiply(curl).multiply(bindQ[i]))
  })

  // driver frames in the T-pose: arms straight out, everything else neutral
  const tPose = Object.fromEntries(DRIVERS.map((d) => [d, new THREE.Quaternion()])) as Record<Driver, THREE.Quaternion>
  for (const [d, sign] of [['shL', 1], ['elL', 1], ['shR', -1], ['elR', -1]] as const) tPose[d].setFromAxisAngle(zAxis, sign * Math.PI / 2)
  const follow = bones.map((bone) => FOLLOW[bone.name] ?? null)
  // (spine and neck blends are between two frames that are identical in the T-pose)
  const offset = bones.map((_, i) => { const f = follow[i]; return f ? tPose[f.a].clone().invert().multiply(bindQ[i]) : null })

  // contact points ride on the bones
  const pin = (boneName: string, x: number, y: number, z: number) => {
    const bone = bones[at(boneName)]
    const o = new THREE.Object3D()
    o.position.copy(bone.worldToLocal(new THREE.Vector3(x, y, z)))
    bone.add(o)
    return o
  }
  const J = (name: string) => bindP[at(name)]
  const hand = (s: 'l' | 'r') => { const h = J(`hand_${s}`); return pin(`hand_${s}`, h.x + (s === 'l' ? 0.085 : -0.085), h.y - 0.028, h.z + 0.01) }
  const points: Points = {
    heelL: pin('foot_l', J('foot_l').x, 0, J('foot_l').z - 0.035), heelR: pin('foot_r', J('foot_r').x, 0, J('foot_r').z - 0.035),
    toeL: pin('foot_l', J('ball_l').x, 0, J('ball_l').z + 0.07), toeR: pin('foot_r', J('ball_r').x, 0, J('ball_r').z + 0.07),
    handL: hand('l'), handR: hand('r'),
    head: pin('Head', 0, J('Head').y + 0.1, J('Head').z + 0.02),
    pelvisPt: pin('pelvis', 0, J('pelvis').y + 0.02, J('pelvis').z + 0.02),
    chestPt: pin('spine_03', 0, J('spine_03').y + 0.07, J('spine_03').z - 0.02),
    kneePtL: pin('calf_l', J('calf_l').x, J('calf_l').y, J('calf_l').z + 0.05), kneePtR: pin('calf_r', J('calf_r').x, J('calf_r').y, J('calf_r').z + 0.05),
    elbowPtL: pin('lowerarm_l', J('lowerarm_l').x, J('lowerarm_l').y, J('lowerarm_l').z), elbowPtR: pin('lowerarm_r', J('lowerarm_r').x, J('lowerarm_r').y, J('lowerarm_r').z),
  }

  return {
    mesh, bones, parent, rest, offset, follow, points,
    world: bones.map(() => new THREE.Quaternion()),
    muscle: bytes(data.muscle),
    dispose: () => { geo.dispose(); material.dispose(); mesh.skeleton.dispose() },
  }
}

/** Paint the heat map: every vertex takes the colour of its muscle's role in this exercise. */
function paint(body: Body, works: Works) {
  const neutral = new THREE.Color(BODY), cool = new THREE.Color(LOOK.idle), warm = new THREE.Color(LOOK.assist), hot = new THREE.Color(LOOK.main)
  const byId = BODY_MUSCLES.map((slug) => (!slug ? neutral : works.primary.includes(slug) ? hot : works.secondary.includes(slug) ? warm : cool))
  const color = body.mesh.geometry.getAttribute('color') as THREE.BufferAttribute
  for (let v = 0; v < body.muscle.length; v++) { const c = byId[body.muscle[v]]; color.setXYZ(v, c.r, c.g, c.b) }
  color.needsUpdate = true
}

/**
 * An anatomical human figure. Joint angles come from the pattern library and
 * are applied to the skeleton every frame; the body is then grounded on the
 * floor, a bench, a seat or a bar depending on the movement.
 */
export function Mannequin({ pattern, speedRef, onPhase, playingRef, works = { primary: [], secondary: [] }, female = false, at }: {
  works?: Works
  /** kept for callers; the anatomical figure does not use a skin tone */
  tone?: string
  female?: boolean
  /** freeze the figure at this time in the movement (a still picture) instead of animating */
  at?: number
  pattern: Pattern
  speedRef: MutableRefObject<number>
  playingRef: MutableRefObject<boolean>
  onPhase?: (label: string, phase: number) => void
}) {
  const body = useMemo(() => buildBody(female ? FEMALE : MALE), [female])
  useEffect(() => () => body.dispose(), [body])
  useEffect(() => paint(body, works), [body, works])

  // a stable, mutable bag of scene-graph handles (filled by ref callbacks, read in useFrame)
  const r = useRef<Rig>({} as Rig).current
  Object.assign(r, body.points)
  const set = (k: keyof Rig) => (g: THREE.Group | null) => { r[k] = g }
  const time = useRef(0)
  const lastPhase = useRef(-1)
  const still = useRef(0)
  const centerZ = useRef<number | null>(null)
  const v = useMemo(() => ({
    a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(),
    e: new THREE.Euler(), t: new THREE.Quaternion(), inv: new THREE.Quaternion(),
    drive: Object.fromEntries(DRIVERS.map((d) => [d, new THREE.Quaternion()])) as Record<Driver, THREE.Quaternion>,
  }), [])
  const sidePlane = pattern.elbowPlane === 'side'

  useFrame((_, delta) => {
    if (!r.root) return
    if (at != null) {
      // a still picture only needs posing once (a few frames, so grounding settles)
      if (still.current > 3) return
      still.current++
      time.current = at
    } else if (playingRef.current) time.current += Math.min(delta, 0.05) * speedRef.current
    const { pose, label, phase } = sample(pattern, time.current)
    if (phase !== lastPhase.current) { lastPhase.current = phase; onPhase?.(label, phase) }

    // joint frames, relative to the figure's root
    const q = v.drive
    const turn = (out: THREE.Quaternion, base: THREE.Quaternion, x: number, y: number, z: number, order: THREE.EulerOrder = 'XYZ') => out.copy(base).multiply(v.t.setFromEuler(v.e.set(x, y, z, order)))
    r.root.rotation.x = pose.pitch * D
    q.pelvis.setFromEuler(v.e.set(pose.pelvis * D, 0, 0))
    turn(q.spine, q.pelvis, pose.lean * D, 0, 0)
    turn(q.neck, q.spine, (pose.neck - pose.lean * 0.3) * D, 0, 0)
    const flatten = pattern.ground === 'feet' || pattern.ground === 'seat'
    for (const s of ['L', 'R'] as const) {
      const side = pose[s]
      const sign = s === 'L' ? 1 : -1
      turn(q[`hip${s}`], q.pelvis, -side.hip * D, 0, sign * side.hipAbd * D)
      turn(q[`knee${s}`], q[`hip${s}`], side.knee * D, 0, 0)
      const acc = (flatten ? pose.pitch : 0) + pose.pelvis - side.hip + side.knee
      turn(q[`ankle${s}`], q[`knee${s}`], (-acc + side.toe) * D, 0, 0)
      turn(q[`sh${s}`], q.spine, -side.shFlex * D, 0, sign * side.shAbd * D, 'XZY')
      // presses and pulls bend in the frontal plane; everything else in the sagittal plane
      if (sidePlane) turn(q[`el${s}`], q[`sh${s}`], 0, 0, sign * side.elbow * D)
      else turn(q[`el${s}`], q[`sh${s}`], -side.elbow * D, 0, 0)
    }

    // skeleton: driven bones take their joint's frame, the rest keep their rest rotation
    for (let i = 0; i < body.bones.length; i++) {
      const f = body.follow[i]
      const p = body.parent[i]
      const world = body.world[i]
      if (f) {
        world.copy(q[f.a])
        if (f.b) world.slerp(q[f.b], f.mix ?? 0.5)
        world.multiply(body.offset[i]!)
        if (p >= 0) body.bones[i].quaternion.copy(v.inv.copy(body.world[p]).invert()).multiply(world)
        else body.bones[i].quaternion.copy(world)
      } else {
        body.bones[i].quaternion.copy(body.rest[i])
        if (p >= 0) world.copy(body.world[p]).multiply(body.rest[i])
        else world.copy(body.rest[i])
      }
    }

    // ground the body
    r.root.position.set(0, 0, 0)
    r.root.updateMatrixWorld(true)
    const y = (g: P) => g!.getWorldPosition(v.a).y
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
    const show = (g: P, on: boolean) => { if (g) g.visible = on }
    show(r.barbell, pattern.load === 'barbell'); show(r.dbL, pattern.load === 'dumbbell'); show(r.dbR, pattern.load === 'dumbbell'); show(r.kb, pattern.load === 'kettlebell')
    if (pattern.load === 'barbell') {
      r.barbell!.position.copy(mid3); r.barbell!.quaternion.copy(v.q)
      // on the back the bar sits behind the neck, a little behind the hands that steady it
      if (pattern.barOnBack) r.barbell!.position.add(v.a.set(0, -0.015, -0.075).applyQuaternion(q.spine).applyQuaternion(r.root.quaternion))
    }
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
        <primitive object={body.mesh} />
      </group>

      {/* equipment (positioned every frame) */}
      <group ref={set('barbell')} visible={false}>
        <mesh><cylinderGeometry args={[0.014, 0.014, 1.6, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} /></mesh>
        {[-0.68, 0.68].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.225, 0.225, 0.06, 36]} /><meshStandardMaterial color={PLATE} metalness={0.35} roughness={0.45} /></mesh>)}
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
      <group ref={set('bench')} visible={false}><mesh><boxGeometry args={[0.32, 0.47, 1.25]} /><meshStandardMaterial color={PROP} roughness={0.8} /></mesh></group>
      <group ref={set('seat')} visible={false}><mesh><boxGeometry args={[0.42, 0.48, 0.42]} /><meshStandardMaterial color={PROP} roughness={0.8} /></mesh></group>
      <group ref={set('bar')} visible={false}><mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 1.3, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh></group>
      {(['dipL', 'dipR'] as const).map((k) => (
        <group key={k} ref={set(k)} visible={false}><mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.9, 10]} /><meshStandardMaterial color={METAL} metalness={0.8} /></mesh></group>
      ))}
    </group>
  )
}
