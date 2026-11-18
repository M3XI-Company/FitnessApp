import { Component, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { Image, Platform, StyleSheet, View } from 'react-native'
import { Asset } from 'expo-asset'
import * as THREE from 'three'
import { Canvas, useFrame } from './r3f'
import { boneShapes, jointsAt, motionAt, type MotionRig } from '../../lib/artMotion'

/**
 * Moves an exercise picture itself. The picture is laid on a fine net and the
 * net is bent at the figure's joints: each bone is a line on the picture (hip
 * to knee, knee to ankle, the trunk with the bar) that turns and shifts to
 * where it is at that moment of the movement, and every point of the picture
 * follows the bone it lies nearest, so a limb stays straight and turns at its
 * joint. Where parts cross (an arm over the chest) the nearer one is drawn on
 * top. The joints for each picture are described in src/lib/artMotion.ts, and
 * scripts/preview-exercise-motion.py draws the same bend for tuning them.
 */
/** The pull of the picture's own place, so everything far from the body stays put. */
const STILL = 0.02
/** How cleanly a point goes to its nearest bone, so a limb turns at its joint instead of bowing. */
const SHARP = 3
/** A point this close to a bone (1 on it, 0 far away) is part of the limb, not the space around it. */
const CORE = 0.25
/** Net spacing, in picture pixels. */
const CELL = 6

function distance(x: number, y: number, s: number[]) {
  const dx = s[2] - s[0], dy = s[3] - s[1]
  const u = Math.min(1, Math.max(0, ((x - s[0]) * dx + (y - s[1]) * dy) / Math.max(dx * dx + dy * dy, 1e-6)))
  return Math.hypot(x - (s[0] + u * dx), y - (s[1] + u * dy))
}

function buildNet(rig: MotionRig) {
  const [W, H] = rig.size
  // a margin beyond the picture, filled with its edge colour, covers the frame when it is drawn smaller,
  // and its outer edge never moves, so nothing the figure pulls on can uncover the frame
  const side = Math.max((1 / rig.zoom - 1) / 2 + 0.02, 0.1)
  const x0 = -side * W, x1 = (1 + side) * W, y0 = -Math.max(1 / rig.zoom - 1 + 0.02, 0.2) * H, y1 = 1.1 * H
  const cols = Math.ceil((x1 - x0) / CELL), rows = Math.ceil((y1 - y0) / CELL)
  const n = (cols + 1) * (rows + 1)
  const B = rig.bones.length
  const rest = new Float32Array(n * 2)
  const position = new Float32Array(n * 3)
  const uv = new Float32Array(n * 2)
  const weight = new Float32Array(n * B)
  const moving: number[] = []
  const shapes = rig.bones.map((b) => boneShapes(rig, b))
  const raw = new Float32Array(B), core = new Float32Array(B)
  for (let r = 0, i = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++, i++) {
      const x = x0 + ((x1 - x0) * c) / cols, y = y0 + ((y1 - y0) * r) / rows
      rest[i * 2] = x; rest[i * 2 + 1] = y
      position[i * 3] = x - W / 2; position[i * 3 + 1] = H - y
      uv[i * 2] = Math.min(0.999, Math.max(0.001, x / W)); uv[i * 2 + 1] = Math.min(0.999, Math.max(0.001, 1 - y / H))
      let total = 0, share = 1e-30
      for (let b = 0; b < B; b++) {
        let w = 0, c = 0
        for (const s of shapes[b]) {
          const near = Math.exp(-2 * (distance(x, y, s) / s[4]) ** 2)
          w = Math.max(w, (s[5] ?? 1) * near)
          c = Math.max(c, near)
        }
        raw[b] = w ** SHARP
        core[b] = Math.min(1, Math.max(0, (c - CORE) / 0.1 + 0.5))
        total += w
        share += raw[b]
      }
      // the limb itself lies at its bone's level; the empty picture around it lies behind everything
      const follow = r === 0 || c === 0 || r === rows || c === cols ? 0 : total / (total + STILL)
      let depth = 0
      for (let b = 0; b < B; b++) {
        const w = (follow * raw[b]) / share
        weight[i * B + b] = w
        depth += w * ((rig.bones[b].z ?? 1) * core[b] - 0.2 * (1 - core[b]))
      }
      position[i * 3 + 2] = depth
      if (follow > 0.01) moving.push(i)
    }
  }
  const index: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1
      index.push(a, d, b, b, d, e)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(n > 65535 ? new THREE.BufferAttribute(new Uint32Array(index), 1) : new THREE.BufferAttribute(new Uint16Array(index), 1))
  return { geo, rest, weight, moving, B, W, H }
}

/** The picture as something the 3D canvas can draw: read from the app's own files on a phone, from its address on the web. */
function usePicture(art: number) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let live = true
    let made: THREE.Texture | null = null
    const ready = (t: THREE.Texture) => {
      t.generateMipmaps = false
      t.minFilter = THREE.LinearFilter
      t.magFilter = THREE.LinearFilter
      t.needsUpdate = true
      made = t
      if (live) setTexture(t); else t.dispose()
    }
    Asset.fromModule(art).downloadAsync().then((asset) => {
      if (Platform.OS === 'web') { new THREE.TextureLoader().load(asset.uri, ready); return }
      const t = new THREE.Texture()
      // expo-gl reads a picture straight from a file when it is handed over in this form
      t.image = { data: { localUri: asset.localUri ?? asset.uri }, width: asset.width ?? 1, height: asset.height ?? 1 }
      t.flipY = true
      ;(t as unknown as { isDataTexture: boolean }).isDataTexture = true
      ready(t)
    }).catch(() => {})
    return () => { live = false; made?.dispose() }
  }, [art])
  return texture
}

function Net({ art, rig, playingRef, onDrawn }: { art: number; rig: MotionRig; playingRef: MutableRefObject<boolean>; onDrawn: () => void }) {
  const texture = usePicture(art)
  const mesh = useRef<THREE.Mesh>(null)
  const net = useMemo(() => buildNet(rig), [rig])
  useEffect(() => () => net.geo.dispose(), [net])
  const time = useRef(0)
  const frames = useRef(0)
  const turn = useMemo(() => new Float32Array(net.B * 6), [net])
  const drawn = useMemo(() => jointsAt(rig, 0), [rig])

  useFrame((state, delta) => {
    if (!texture || !mesh.current) return
    // fitted to what the camera really shows this frame, which is right even while the canvas is still finding its size
    const cam = state.camera as THREE.OrthographicCamera
    const wide = (cam.right - cam.left) / cam.zoom, tall = (cam.top - cam.bottom) / cam.zoom
    if (!(wide > 0)) return
    const k = (wide / net.W) * rig.zoom
    mesh.current.scale.set(k, k, 1)
    mesh.current.position.set(0, -tall / 2, 0)
    // the still picture stays in front until the moving one has really been drawn
    if (++frames.current === 3) onDrawn()
    if (frames.current < 3) return
    if (playingRef.current) time.current += Math.min(delta, 0.05)
    const t = motionAt(rig, time.current)
    // each bone turns, and stretches along its own length only: four numbers for that, two for where it has moved to
    const now = jointsAt(rig, t)
    for (let b = 0; b < net.B; b++) {
      const bone = rig.bones[b]
      const a0 = drawn[bone.a], b0 = drawn[bone.b], a1 = now[bone.a], b1 = now[bone.b]
      const l0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), l1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1])
      const ex = (b0[0] - a0[0]) / l0, ey = (b0[1] - a0[1]) / l0
      const fx = l1 > 1e-6 ? (b1[0] - a1[0]) / l1 : ex, fy = l1 > 1e-6 ? (b1[1] - a1[1]) / l1 : ey
      const s = l1 / l0
      const m00 = s * fx * ex + fy * ey, m01 = s * fx * ey - fy * ex, m10 = s * fy * ex - fx * ey, m11 = s * fy * ey + fx * ex
      turn[b * 6] = m00; turn[b * 6 + 1] = m01; turn[b * 6 + 2] = m10; turn[b * 6 + 3] = m11
      turn[b * 6 + 4] = a1[0] - (m00 * a0[0] + m01 * a0[1]); turn[b * 6 + 5] = a1[1] - (m10 * a0[0] + m11 * a0[1])
    }
    const pos = net.geo.getAttribute('position') as THREE.BufferAttribute
    const out3 = pos.array as Float32Array
    for (const i of net.moving) {
      const x = net.rest[i * 2], y = net.rest[i * 2 + 1]
      let sx = 0, sy = 0, sw = 0
      for (let b = 0; b < net.B; b++) {
        const w = net.weight[i * net.B + b]
        if (w < 0.0005) continue
        const o = b * 6
        sx += w * (x * turn[o] + y * turn[o + 1] + turn[o + 4]); sy += w * (x * turn[o + 2] + y * turn[o + 3] + turn[o + 5]); sw += w
      }
      out3[i * 3] = sx + (1 - sw) * x - net.W / 2
      out3[i * 3 + 1] = net.H - (sy + (1 - sw) * y)
    }
    pos.needsUpdate = true
  })

  if (!texture) return null
  return (
    <mesh ref={mesh} geometry={net.geo} scale={0} frustumCulled={false}>
      <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Shows the still picture instead if the phone cannot start the moving one. */
class StillOnFailure extends Component<{ still: ReactNode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFail() }
  render() { return this.state.failed ? this.props.still : this.props.children }
}

/** How many times the moving picture is started again when the phone's graphics do not come up. */
const TRIES = 3

/** The picture of an exercise, moving. Fills its parent, which sets the size. */
export function ArtMotion({ art, rig }: { art: number; rig: MotionRig }) {
  const playingRef = useRef(true)
  const [drawn, setDrawn] = useState(false)
  // a phone's graphics sometimes fail to start, most often straight after another screen let go of them:
  // rather than leave a picture that never moves, start again a moment later, and again if nothing has been drawn
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (drawn || attempt >= TRIES - 1) return
    const t = setTimeout(() => setAttempt((n) => n + 1), 2500)
    return () => clearTimeout(t)
  }, [drawn, attempt])
  const again = () => { if (attempt < TRIES - 1) setTimeout(() => setAttempt((n) => n + 1), 500) }
  // given its size outright: left to itself a picture is drawn at its own, larger than the screen
  const still = <Image source={art} resizeMode="contain" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />
  return (
    <View style={StyleSheet.absoluteFill}>
      <StillOnFailure key={attempt} still={still} onFail={again}>
        <Canvas orthographic linear flat gl={{ antialias: true }}>
          <Net art={art} rig={rig} playingRef={playingRef} onDrawn={() => setDrawn(true)} />
        </Canvas>
      </StillOnFailure>
      {!drawn && still}
    </View>
  )
}
