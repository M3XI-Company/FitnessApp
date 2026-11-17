import test from 'node:test'
import assert from 'node:assert/strict'
import { gustPath, gustReach, type Gust } from '../src/lib/gust'

const gust: Gust = { length: 120, width: 10, hook: 14, turn: 4.2, bend: 0.15, ripples: 1.2, phase: 0.7 }
const points = (d: string) => d.slice(1, -1).split('L').map((p) => p.split(' ').map(Number))

test('a gust is one closed outline of real numbers', () => {
  const d = gustPath(gust, 10, 100, 0)
  assert.match(d, /^M[-\d. L]+Z$/)
  for (const [x, y] of points(d)) assert.ok(Number.isFinite(x) && Number.isFinite(y))
})

test('it starts as a fine point at its tail and stays within its reach', () => {
  const pts = points(gustPath(gust, 10, 100, 0))
  const [first, last] = [pts[0], pts[pts.length - 1]]
  // the two edges meet, near enough, at the tail
  assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.5)
  assert.ok(Math.hypot(first[0] - 10, first[1] - 100) < 1)
  for (const [x] of pts) assert.ok(x < 10 + gustReach(gust), `x ${x} is past its reach`)
})

test('the line itself moves: the same gust in the same place is a different shape a moment later', () => {
  const a = points(gustPath(gust, 10, 100, 0))
  const b = points(gustPath(gust, 10, 100, 0.4))
  assert.equal(a.length, b.length)
  const moved = a.filter(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1]) > 0.5).length
  assert.ok(moved > a.length / 2, `${moved} of ${a.length} points moved`)
})

test('the hook curls up or down', () => {
  const ys = (g: Gust) => points(gustPath({ ...g, bend: 0 }, 0, 100, 0)).map(([, y]) => y)
  assert.ok(Math.min(...ys(gust)) < 80)
  assert.ok(Math.max(...ys({ ...gust, turn: -4.2 })) > 120)
})
