// Bakes the CC0 Quaternius "Universal Base Characters" superhero bodies
// (assets/models/quaternius) into compact TypeScript modules the 3D trainer
// loads without any asset pipeline: positions, normals, skin weights, the
// skeleton, and a per-vertex muscle id used for the heat map.
//
//   node scripts/build-body.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'assets/models/quaternius')
const OUT = join(ROOT, 'src/components/trainer/body')

// index 0 = no muscle (joints, hands, feet, head, the gaps between panels)
export const SLUGS = ['', 'abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids', 'forearm', 'gluteal', 'hamstring', 'lower-back', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back']
const ID = Object.fromEntries(SLUGS.map((s, i) => [s, i]))

// ---- tiny quaternion helpers ([x, y, z, w]) --------------------------------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]]
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qconj(q)); return [r[0], r[1], r[2]] }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const r5 = (x) => Math.round(x * 1e5) / 1e5

const COMPONENT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

function bake(file, exportName) {
  const gltf = JSON.parse(readFileSync(join(SRC, file + '.gltf'), 'utf8'))
  const bin = readFileSync(join(SRC, gltf.buffers[0].uri))

  const read = (index) => {
    const acc = gltf.accessors[index]
    const view = gltf.bufferViews[acc.bufferView]
    const Type = COMPONENT[acc.componentType]
    const width = WIDTH[acc.type]
    const stride = view.byteStride ?? Type.BYTES_PER_ELEMENT * width
    const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
    const out = new Type(acc.count * width)
    const dv = new DataView(bin.buffer, bin.byteOffset + start)
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[acc.componentType]
    for (let i = 0; i < acc.count; i++) for (let k = 0; k < width; k++) out[i * width + k] = dv[get](i * stride + k * Type.BYTES_PER_ELEMENT, true)
    return { data: out, count: acc.count, normalized: !!acc.normalized, type: acc.componentType }
  }

  // the body is the biggest primitive (the others are eyes and eyebrows)
  let prim = null
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) if (!prim || gltf.accessors[p.attributes.POSITION].count > gltf.accessors[prim.attributes.POSITION].count) prim = p
  const pos = read(prim.attributes.POSITION).data
  const nrm = read(prim.attributes.NORMAL).data
  const joints = read(prim.attributes.JOINTS_0).data
  const w = read(prim.attributes.WEIGHTS_0)
  const idx = read(prim.indices).data
  const n = pos.length / 3
  const wScale = w.type === 5126 ? 1 : w.type === 5121 ? 1 / 255 : 1 / 65535

  // ---- skeleton -----------------------------------------------------------
  const nodes = gltf.nodes
  const parentOf = new Map()
  nodes.forEach((nd, i) => (nd.children ?? []).forEach((c) => parentOf.set(c, i)))
  const world = new Map()
  const worldOf = (i) => {
    if (world.has(i)) return world.get(i)
    const nd = nodes[i]
    const t = nd.translation ?? [0, 0, 0]
    const q = nd.rotation ?? [0, 0, 0, 1]
    let res = { p: t, q }
    if (parentOf.has(i)) { const pw = worldOf(parentOf.get(i)); res = { p: add(pw.p, qrot(pw.q, t)), q: qmul(pw.q, q) } }
    world.set(i, res)
    return res
  }
  const skin = gltf.skins[0]
  const jointIndex = new Map(skin.joints.map((node, j) => [node, j]))
  const bones = skin.joints.map((node) => {
    const me = worldOf(node)
    const parentNode = parentOf.get(node)
    const parent = jointIndex.has(parentNode) ? jointIndex.get(parentNode) : -1
    if (parent < 0) return { n: nodes[node].name, p: -1, t: me.p.map(r5), q: me.q.map(r5) }
    const pw = worldOf(parentNode)
    return { n: nodes[node].name, p: parent, t: qrot(qconj(pw.q), sub(me.p, pw.p)).map(r5), q: qmul(qconj(pw.q), me.q).map(r5) }
  })
  const J = {}
  skin.joints.forEach((node) => { J[nodes[node].name] = worldOf(node).p })
  const boneName = skin.joints.map((node) => nodes[node].name)

  // ---- muscle regions (bind pose is a T-pose: arms along ±x, +z is forward) --
  const muscle = new Uint8Array(n)
  const zMid = (J.spine_02[2] + J.spine_03[2]) / 2 - 0.02 // front/back split of the trunk
  for (let v = 0; v < n; v++) {
    const x = Math.abs(pos[v * 3]), y = pos[v * 3 + 1], z = pos[v * 3 + 2]
    let best = 0
    for (let k = 1; k < 4; k++) if (w.data[v * 4 + k] > w.data[v * 4 + best]) best = k
    const bone = boneName[joints[v * 4 + best]].replace(/_[lr]$/, '')
    const front = z > zMid
    let m = ''
    if (bone === 'upperarm' || bone === 'clavicle' || bone === 'spine_03' || bone === 'spine_02' || bone === 'spine_01' || bone === 'pelvis') {
      const armT = (x - J.upperarm_l[0]) / (J.lowerarm_l[0] - J.upperarm_l[0])
      const shoulder = x > J.upperarm_l[0] - 0.045 && y > J.upperarm_l[1] - 0.085
      if (bone === 'upperarm' && armT > 0.4) {
        if (armT < 0.9) m = z > J.upperarm_l[2] + 0.004 ? 'biceps' : 'triceps'
      } else if (shoulder || bone === 'upperarm') m = 'deltoids'
      else if (bone === 'pelvis' || y < J.spine_01[1] - 0.03) {
        // hips: glutes behind, the low abdomen in front, nothing at the groin and hip crease
        if (z < J.pelvis[2] - 0.015 && y > J.thigh_l[1] - 0.14) m = 'gluteal'
        else if (z > J.pelvis[2] + 0.06 && x < 0.06 && y > J.pelvis[1] - 0.01) m = 'abs'
      } else if (y < J.spine_03[1] + 0.035) {
        // waist and lower ribs
        if (front) m = x < 0.075 ? 'abs' : 'obliques'
        else if (x < 0.07) m = y < J.spine_02[1] + 0.06 ? 'lower-back' : 'trapezius'
        else m = y > J.spine_02[1] - 0.03 ? 'upper-back' : 'obliques'
      } else if (front) {
        m = y < J.upperarm_l[1] + 0.035 ? 'chest' : 'trapezius'
      } else if (y > J.upperarm_l[1] + 0.02 || (x < 0.075 && y > J.spine_03[1] + 0.06)) m = 'trapezius'
      else m = 'upper-back'
    } else if (bone === 'lowerarm') {
      const t = (x - J.lowerarm_l[0]) / (J.hand_l[0] - J.lowerarm_l[0])
      if (t > 0.06 && t < 0.82) m = 'forearm'
    } else if (bone === 'thigh') {
      const s = (J.thigh_l[1] - y) / (J.thigh_l[1] - J.calf_l[1])
      const dx = x - J.thigh_l[0], dz = z - J.thigh_l[2]
      if (s < 0.9) {
        if (dz < -0.01 && s < 0.2) m = 'gluteal'
        else if (dx < -0.03 && s < 0.62 && dz > -0.045 && dz < 0.045) m = 'adductors'
        else m = dz < -0.012 ? 'hamstring' : 'quadriceps'
      }
    } else if (bone === 'calf') {
      const s = (J.calf_l[1] - y) / (J.calf_l[1] - J.foot_l[1])
      const z0 = J.calf_l[2] + (J.foot_l[2] - J.calf_l[2]) * s
      if (s > 0.07 && s < 0.84) m = z < z0 + 0.008 ? (s < 0.7 ? 'calves' : '') : 'tibialis'
    }
    muscle[v] = ID[m]
  }

  // ---- pack -----------------------------------------------------------------
  const nrm8 = new Int8Array(n * 3)
  for (let i = 0; i < n * 3; i++) nrm8[i] = Math.max(-127, Math.min(127, Math.round(nrm[i] * 127)))
  const skinIndex = new Uint8Array(n * 4)
  const skinWeight = new Uint8Array(n * 4)
  for (let v = 0; v < n; v++) {
    let sum = 0
    for (let k = 0; k < 4; k++) sum += w.data[v * 4 + k] * wScale
    for (let k = 0; k < 4; k++) {
      skinIndex[v * 4 + k] = joints[v * 4 + k]
      skinWeight[v * 4 + k] = Math.round((w.data[v * 4 + k] * wScale / (sum || 1)) * 255)
    }
  }
  if (n > 65535) throw new Error('mesh too large for 16-bit indices')
  const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64')
  const counts = SLUGS.map((s, i) => `${s || 'none'}:${muscle.filter((mm) => mm === i).length}`).join(' ')
  const ts = `// GENERATED by scripts/build-body.mjs from assets/models/quaternius/${file}.gltf — do not edit.
// Model: Quaternius "Universal Base Characters" (CC0 1.0). See assets/models/quaternius/LICENSE.txt
import type { BodyData } from './types'

export const ${exportName}: BodyData = {
  vertices: ${n},
  position: '${b64(new Float32Array(pos))}',
  normal: '${b64(nrm8)}',
  index: '${b64(new Uint16Array(idx))}',
  skinIndex: '${b64(skinIndex)}',
  skinWeight: '${b64(skinWeight)}',
  muscle: '${b64(muscle)}',
  bones: ${JSON.stringify(bones)},
}
`
  writeFileSync(join(OUT, exportName.toLowerCase() + '.ts'), ts)
  console.log(`${exportName}: ${n} vertices, ${idx.length / 3} triangles, ${bones.length} bones\n  ${counts}`)
}

writeFileSync(join(OUT, 'types.ts'), `// GENERATED by scripts/build-body.mjs — do not edit.
export interface BodyBone { n: string; p: number; t: number[]; q: number[] }
/** A skinned body. Buffers are base64: position f32x3, normal i8x3, index u16, skinIndex u8x4, skinWeight u8x4 (÷255), muscle u8. */
export interface BodyData { vertices: number; position: string; normal: string; index: string; skinIndex: string; skinWeight: string; muscle: string; bones: BodyBone[] }
/** Muscle id → slug (0 = not a muscle). Slugs match MuscleSlug in data/exercises. */
export const BODY_MUSCLES = ${JSON.stringify(SLUGS)} as const
`)
bake('Superhero_Male_FullBody', 'MALE')
bake('Superhero_Female_FullBody', 'FEMALE')
