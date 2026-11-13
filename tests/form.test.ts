/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FormSession, LM, angle, type Landmark } from '../src/lib/form/engine'

const D = Math.PI / 180
const add = (p: Landmark, len: number, deg: number): Landmark => ({ x: p.x + len * Math.sin(deg * D), y: p.y - len * Math.cos(deg * D), visibility: 0.95 })

/** Side-view skeleton (facing +x). knee = interior knee angle, lean = torso from vertical, elbow = interior elbow angle */
function body({ knee = 175, lean = 5, elbow = 170, armFromVertical = 0, visibility = 0.95, plankLine = 0, pitch = 0 }: { knee?: number; lean?: number; elbow?: number; armFromVertical?: number; visibility?: number; plankLine?: number; pitch?: number } = {}): Landmark[] {
  const ankle: Landmark = pitch > 45 ? { x: 0.12, y: 0.62, visibility } : { x: 0.5, y: 0.9, visibility }
  // shin tilts forward as you squat; pitch lays the whole leg chain down (push-ups, planks)
  const shinDeg = pitch + 15 * (1 - (knee - 60) / 120)
  const kneeP = add(ankle, 0.22, shinDeg)
  const thighDeg = shinDeg - (180 - knee) // rotate back by the knee flexion
  const hip = add(kneeP, 0.22, thighDeg)
  const shoulder = add(hip, 0.3, lean + plankLine)
  const elbowP = add(shoulder, 0.15, 180 + armFromVertical)
  const wrist = add(elbowP, 0.14, 180 + armFromVertical - (180 - elbow))
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility }))
  const put = (i: number, p: Landmark) => { lm[i] = { ...p, visibility } }
  put(LM.lAnkle, ankle); put(LM.lKnee, kneeP); put(LM.lHip, hip); put(LM.lShoulder, shoulder); put(LM.lElbow, elbowP); put(LM.lWrist, wrist)
  // far side partly hidden, as from a side-on camera
  for (const [l, r] of [[LM.lAnkle, LM.rAnkle], [LM.lKnee, LM.rKnee], [LM.lHip, LM.rHip], [LM.lShoulder, LM.rShoulder], [LM.lElbow, LM.rElbow], [LM.lWrist, LM.rWrist]]) lm[r] = { ...lm[l], visibility: visibility * 0.4 }
  return lm
}

/** Run a cosine movement between two values for n reps at 30 fps */
function run(s: FormSession, reps: number, msPerRep: number, frame: (u: number) => Landmark[], startT = 0) {
  const updates = []
  const fps = 30
  const frames = Math.round((reps * msPerRep * fps) / 1000)
  for (let i = 0; i <= frames; i++) {
    const t = startT + (i * 1000) / fps
    const u = (1 - Math.cos(((2 * Math.PI) * t) / msPerRep)) / 2 // 0 → 1 → 0 each rep
    updates.push(s.push(frame(u), t))
  }
  return updates
}

test('skeleton helper produces the requested knee angle', () => {
  const lm = body({ knee: 90 })
  assert.ok(Math.abs(angle(lm[LM.lHip], lm[LM.lKnee], lm[LM.lAnkle]) - 90) < 0.5)
})

test('squat: counts 5 full reps with no depth cue', () => {
  const s = new FormSession('squat')
  const u = run(s, 5, 2400, (x) => body({ knee: 175 - x * 90, lean: 5 + x * 30 }))
  assert.equal(u.at(-1)!.reps, 5)
  assert.ok(!u.some((x) => x.cue?.id === 'depth'))
})

test('squat: half reps are not counted and suggest more depth', () => {
  const s = new FormSession('squat')
  const u = run(s, 4, 2400, (x) => body({ knee: 175 - x * 45 }))
  assert.equal(u.at(-1)!.reps, 0)
  assert.ok(u.some((x) => x.cue?.id === 'depth'))
})

test('squat: excessive forward lean at the bottom gives a chest-up caution', () => {
  const s = new FormSession('squat')
  const u = run(s, 3, 2400, (x) => body({ knee: 175 - x * 90, lean: 5 + x * 60 }))
  assert.ok(u.some((x) => x.cue?.id === 'chest_up' && x.cue.severity === 'caution'))
  assert.equal(u.at(-1)!.reps, 3)
})

test('poor visibility: no reps, no cues, asks the user to step into view', () => {
  const s = new FormSession('squat')
  const u = run(s, 4, 2400, (x) => body({ knee: 175 - x * 90, lean: 70, visibility: 0.3 }))
  assert.equal(u.at(-1)!.reps, 0)
  assert.ok(u.every((x) => x.status === 'low_confidence' && x.cue === null))
  assert.match(u.at(-1)!.hint ?? '', /whole body/)
})

test('a body partly outside the frame is not tracked', () => {
  const s = new FormSession('squat')
  const lm = body({ knee: 120 }).map((p) => ({ ...p, x: p.x + 0.7 }))
  assert.equal(s.push(lm, 0).status, 'low_confidence')
})

test('no landmarks at all is handled safely', () => {
  const s = new FormSession('pushup')
  const r = s.push(null, 0)
  assert.equal(r.status, 'low_confidence')
  assert.equal(r.reps, 0)
})

test('jitter faster than a human rep is not counted', () => {
  const s = new FormSession('squat')
  const u = run(s, 6, 300, (x) => body({ knee: 175 - x * 90 }))
  assert.equal(u.at(-1)!.reps, 0)
})

test('push-up: counts reps and cues sagging hips', () => {
  const s = new FormSession('pushup')
  // horizontal body (pitch/lean ≈ 90°); a sag bends the shoulder-hip-ankle line by 30°
  const u = run(s, 3, 2000, (x) => body({ knee: 178, pitch: 88, lean: 90, plankLine: -30, elbow: 165 - x * 85 }))
  assert.equal(u.at(-1)!.reps, 3)
  assert.ok(u.some((x) => x.cue?.id === 'hip_line'))
})

test('push-up with a straight body line gets no hip cue', () => {
  const s = new FormSession('pushup')
  const u = run(s, 3, 2000, (x) => body({ knee: 178, pitch: 88, lean: 90, elbow: 165 - x * 85 }))
  assert.equal(u.at(-1)!.reps, 3)
  assert.ok(!u.some((x) => x.cue?.id === 'hip_line'))
})

test('a dismissed cue does not come back', () => {
  const s = new FormSession('squat')
  run(s, 1, 2400, (x) => body({ knee: 175 - x * 90, lean: 5 + x * 60 }))
  s.dismiss('chest_up')
  const u = run(s, 3, 2400, (x) => body({ knee: 175 - x * 90, lean: 5 + x * 60 }), 3000)
  assert.ok(!u.some((x) => x.cue?.id === 'chest_up'))
})

test('the user can correct the rep count', () => {
  const s = new FormSession('squat')
  run(s, 2, 2400, (x) => body({ knee: 175 - x * 90 }))
  s.setReps(3)
  assert.equal(s.push(body(), 99999).reps, 3)
})

test('unsupported exercises throw so the UI can fall back to manual logging', () => {
  assert.throws(() => new FormSession('leg-press'))
})
