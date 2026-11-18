import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { MOTION_RIGS, artMotion, boneShapes, jointsAt, motionAt } from '../src/lib/artMotion'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

test('every rig belongs to a picture that is in the app', () => {
  for (const name of Object.keys(MOTION_RIGS)) assert.ok(existsSync(`assets/exercise/${name}.jpg`), `${name} has no picture`)
})

test('a rig is found by exercise and build, and only where one exists', () => {
  assert.ok(artMotion('squat', 'male'))
  assert.ok(artMotion('squat', 'female'))
  assert.equal(artMotion('no-such-exercise', 'male'), undefined)
})

test('joints lean only on joints listed before them, and something moves', () => {
  for (const [name, rig] of Object.entries(MOTION_RIGS)) {
    const seen = new Set<string>()
    for (const [k, j] of Object.entries(rig.joints)) {
      assert.equal(j.at.length, 2)
      for (const other of [j.with, j.around, ...(j.ik ?? []), ...(j.toward ?? [])]) if (other) assert.ok(seen.has(other), `${name}: ${k} leans on ${other} before it is placed`)
      seen.add(k)
    }
    assert.ok(Object.values(rig.joints).some((j) => j.to), `${name} does not move`)
  }
})

test('bones join two different joints and pull on lines with a reach', () => {
  for (const [name, rig] of Object.entries(MOTION_RIGS)) {
    for (const b of rig.bones) {
      assert.ok(rig.joints[b.a] && rig.joints[b.b], `${name}: a bone has no joint`)
      assert.ok(dist(rig.joints[b.a].at, rig.joints[b.b].at) > 1, `${name} has a bone with no length`)
      for (const s of boneShapes(rig, b)) assert.ok((s.length === 5 || s.length === 6) && s[4] > 0)
    }
  }
})

test('joints start as drawn and every bone keeps a length all the way through', () => {
  for (const [name, rig] of Object.entries(MOTION_RIGS)) {
    const drawn = jointsAt(rig, 0)
    for (const [k, j] of Object.entries(rig.joints)) assert.ok(dist(drawn[k], j.at) < 0.01, `${name}: ${k} does not start where it is drawn`)
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const now = jointsAt(rig, t)
      for (const b of rig.bones) {
        const l = dist(now[b.a], now[b.b])
        assert.ok(Number.isFinite(l) && l > 1, `${name}: a bone collapses at ${t}`)
      }
    }
  }
})

test('an elbow is found from the shoulder and the hand, so the arm bends instead of bowing', () => {
  const rig = artMotion('pushup', 'male')!
  const start = jointsAt(rig, 0), half = jointsAt(rig, 0.5), end = jointsAt(rig, 1)
  // the hand stays planted while the shoulder comes down
  assert.deepEqual(half.handL, start.handL)
  assert.ok(end.shL[1] > start.shL[1] + 60)
  // each half of the arm changes length smoothly between how it is drawn and how it ends, never more
  for (const [a, b] of [['shL', 'elL'], ['elL', 'handL']]) {
    const lo = Math.min(dist(start[a], start[b]), dist(end[a], end[b])), hi = Math.max(dist(start[a], start[b]), dist(end[a], end[b]))
    const mid = dist(half[a], half[b])
    assert.ok(mid > lo - 0.5 && mid < hi + 0.5)
  }
})

test('the movement starts as drawn, reaches the other end, and comes back', () => {
  const rig = artMotion('squat', 'male')!
  const s = rig.seconds
  assert.equal(motionAt(rig, 0), 0)
  assert.equal(motionAt(rig, s.hold + s.move + s.top / 2), 1)
  const half = motionAt(rig, s.hold + s.move / 2)
  assert.ok(half > 0.4 && half < 0.6)
  const total = s.hold + s.move + s.top + s.back
  assert.ok(motionAt(rig, total - 0.01) < 0.01)
  assert.equal(motionAt(rig, total), 0)
})
