/**
 * The joints that let an exercise picture move. A picture is bent at its
 * bones: each is a line between two joints (shoulder to elbow, elbow to hand,
 * the trunk with the bar), and each joint is given where it is drawn and where
 * it is at the other end of the movement. The rigs are in
 * src/data/exerciseMotion.json, one for each picture that has been given
 * joints; src/components/trainer/ArtMotion.tsx draws them, and
 * scripts/preview-exercise-motion.py previews them.
 */
import MOTION from '../data/exerciseMotion.json'

export interface MotionJoint {
  /** where the joint is drawn, in picture pixels */
  at: number[]
  /** where it is at the other end of the movement; without it the joint stays put */
  to?: number[]
  /** moves exactly as this other joint does (a hip with the pelvis, the bar with the hands) */
  with?: string
  /** swings around this other joint instead of going straight, so a straight limb keeps its length */
  around?: string
  /** stays its drawn distance from the first joint, on the line to the second: a cable's clip between hand and pulley */
  toward?: string[]
  /** the middle of a limb (elbow, knee) between these two joints: found from them so both halves stay rigid */
  ik?: string[]
}
export interface MotionBone {
  name?: string
  /** the joints at its two ends */
  a: string
  b: string
  /** what it passes in front of when parts cross: higher is nearer (1 unless given) */
  z?: number
  /** how far its pull reaches, when it has no shapes of its own */
  r?: number
  /** the parts of the picture that follow this bone: lines, each with how far its pull reaches and, optionally, how strong it is (1 unless given) */
  shapes?: number[][]
}
export interface MotionRig {
  size: number[]
  /** how much smaller the picture is drawn while moving, so a figure that stands up stays in the frame */
  zoom: number
  /** how long it rests as drawn, moves out, rests there, and comes back */
  seconds: { hold: number; move: number; top: number; back: number }
  joints: Record<string, MotionJoint>
  bones: MotionBone[]
}

export const MOTION_RIGS = MOTION as unknown as Record<string, MotionRig>

/** The joints for an exercise's picture, when it has been given any. */
export function artMotion(exerciseId: string, sex: 'male' | 'female'): MotionRig | undefined {
  return MOTION_RIGS[`${exerciseId.replace(/-/g, '_')}_${sex}`]
}

const ease = (t: number) => t * t * (3 - 2 * t)

/** How far through the movement the figure is at a time in seconds: 0 as drawn, 1 at the other end. */
export function motionAt(rig: MotionRig, time: number): number {
  const s = rig.seconds
  const total = s.hold + s.move + s.top + s.back
  let x = ((time % total) + total) % total
  if (x < s.hold) return 0
  x -= s.hold
  if (x < s.move) return ease(x / s.move)
  x -= s.move
  if (x < s.top) return 1
  return 1 - ease((x - s.top) / s.back)
}

type Point = number[]
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** The middle joint of a limb of two lengths between its two ends, bent to the given side. */
function middle(r: Point, e: Point, l1: number, l2: number, side: number): Point {
  const dx = e[0] - r[0], dy = e[1] - r[1]
  const d = Math.max(Math.hypot(dx, dy), 1e-6)
  const ux = dx / d, uy = dy / d
  if (d >= l1 + l2 || d <= Math.abs(l1 - l2)) return [r[0] + (ux * d * l1) / (l1 + l2), r[1] + (uy * d * l1) / (l1 + l2)]
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0)) * side
  return [r[0] + ux * a - uy * h, r[1] + uy * a + ux * h]
}

/** Which side of the line between a limb's ends its middle joint is on: 1, -1, or 0 when the limb is straight. */
function sideOf(r: Point, e: Point, m: Point) {
  const across = ((e[0] - r[0]) * (m[1] - r[1]) - (e[1] - r[1]) * (m[0] - r[0])) / Math.max(dist(r, e), 1e-6)
  return Math.abs(across) < 0.01 ? 0 : across > 0 ? 1 : -1
}

/**
 * Where every joint is, t of the way through the movement (0 as drawn, 1 at
 * the other end). A joint may lean on joints listed before it.
 */
export function jointsAt(rig: MotionRig, t: number): Record<string, Point> {
  const J = rig.joints
  const end: Record<string, Point> = {}
  const now: Record<string, Point> = {}
  for (const k of Object.keys(J)) {
    const j = J[k], a = j.at
    if (j.with) {
      const o = j.with, oa = J[o].at
      end[k] = [a[0] + end[o][0] - oa[0], a[1] + end[o][1] - oa[1]]
      now[k] = [a[0] + now[o][0] - oa[0], a[1] + now[o][1] - oa[1]]
    } else if (j.toward) {
      const [f, g] = j.toward
      const far = dist(a, J[f].at)
      for (const pos of [end, now]) {
        const k_ = far / Math.max(dist(pos[f], pos[g]), 1e-6)
        pos[k] = [pos[f][0] + (pos[g][0] - pos[f][0]) * k_, pos[f][1] + (pos[g][1] - pos[f][1]) * k_]
      }
    } else if (j.ik) {
      const [r, e] = j.ik
      const l1 = dist(a, J[r].at), l2 = dist(a, J[e].at)
      let m1 = l1, m2 = l2, s0 = sideOf(J[r].at, J[e].at, a), s1 = s0
      if (j.to) {
        end[k] = j.to
        m1 = dist(j.to, end[r]); m2 = dist(j.to, end[e]); s1 = sideOf(end[r], end[e], j.to)
      } else {
        end[k] = middle(end[r], end[e], l1, l2, s0)
      }
      // a limb drawn straight bends to the side it ends on; one that ends on the other side passes through straight
      s0 = s0 || s1; s1 = s1 || s0
      now[k] = middle(now[r], now[e], l1 + (m1 - l1) * t, l2 + (m2 - l2) * t, s0 + (s1 - s0) * t)
    } else if (j.around && j.to) {
      const c = j.around
      end[k] = j.to
      const v0 = [a[0] - J[c].at[0], a[1] - J[c].at[1]], v1 = [j.to[0] - end[c][0], j.to[1] - end[c][1]]
      const a0 = Math.atan2(v0[1], v0[0])
      let da = Math.atan2(v1[1], v1[0]) - a0
      da = ((((da + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
      const r0 = Math.hypot(v0[0], v0[1]), rad = r0 + (Math.hypot(v1[0], v1[1]) - r0) * t
      now[k] = [now[c][0] + rad * Math.cos(a0 + da * t), now[c][1] + rad * Math.sin(a0 + da * t)]
    } else {
      end[k] = j.to ?? a
      now[k] = [a[0] + (end[k][0] - a[0]) * t, a[1] + (end[k][1] - a[1]) * t]
    }
  }
  return now
}

/** The lines a bone pulls on: its own, or the bone itself as drawn. */
export function boneShapes(rig: MotionRig, bone: MotionBone): number[][] {
  return bone.shapes ?? [[...rig.joints[bone.a].at, ...rig.joints[bone.b].at, bone.r ?? 30]]
}
