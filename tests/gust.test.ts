import test from 'node:test'
import assert from 'node:assert/strict'
import { gustPath, gustReach, type Gust } from '../src/lib/gust'

const gust: Gust = { length: 120, width: 10, bend: 0.25, swerve: 0, ripples: 0.5, phase: 0.7 }
const points = (d: string) => d.slice(1, -1).split('L').map((p) => p.split(' ').map(Number))
/** How thick the streak is at each step along it: the gap between its two edges. */
const thickness = (d: string) => { const p = points(d); const n = p.length / 2; return Array.from({ length: n }, (_, i) => Math.hypot(p[i][0] - p[p.length - 1 - i][0], p[i][1] - p[p.length - 1 - i][1])) }

test('a streak is one closed outline of real numbers', () => {
  const d = gustPath(gust, 10, 100, 0)
  assert.match(d, /^M[-\d. L]+Z$/)
  for (const [x, y] of points(d)) assert.ok(Number.isFinite(x) && Number.isFinite(y))
})

test('it comes to a fine point at both ends and is fullest in the middle, with no head', () => {
  const t = thickness(gustPath(gust, 10, 100, 0))
  assert.ok(t[0] < 0.5 && t[t.length - 1] < 0.5, `ends ${t[0]} ${t[t.length - 1]}`)
  const widest = t.indexOf(Math.max(...t))
  assert.ok(Math.abs(widest - (t.length - 1) / 2) <= 1, `widest at ${widest} of ${t.length}`)
  assert.ok(Math.abs(Math.max(...t) - gust.width) < 0.5)
  // the same either side of the middle: nothing that reads as a head and a tail
  for (let i = 0; i < t.length / 2; i++) assert.ok(Math.abs(t[i] - t[t.length - 1 - i]) < 0.6, `step ${i}: ${t[i]} against ${t[t.length - 1 - i]}`)
})

test('it starts at its trailing point and stays within its reach', () => {
  const pts = points(gustPath(gust, 10, 100, 0))
  assert.ok(Math.hypot(pts[0][0] - 10, pts[0][1] - 100) < 1)
  for (const [x] of pts) assert.ok(x < 10 + gustReach(gust), `x ${x} is past its reach`)
})

test('the line itself moves: the same streak in the same place is a different shape a moment later', () => {
  const a = points(gustPath(gust, 10, 100, 0))
  const b = points(gustPath(gust, 10, 100, 1.5))
  assert.equal(a.length, b.length)
  const moved = a.filter(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1]) > 0.5).length
  assert.ok(moved > a.length / 2, `${moved} of ${a.length} points moved`)
})

test('a livelier wind curves the streak more, and it never doubles back', () => {
  const spread = (wild: number) => { const ys = points(gustPath(gust, 10, 100, 0.3, wild)).map(([, y]) => y); return Math.max(...ys) - Math.min(...ys) }
  assert.ok(spread(1.75) > spread(1) && spread(1) > spread(0.2), `${spread(0.2)} ${spread(1)} ${spread(1.75)}`)
  // along one edge the streak only ever goes forwards, however wild
  const edge = points(gustPath(gust, 10, 100, 0.3, 3)).slice(0, 29).map(([x]) => x)
  for (let i = 1; i < edge.length; i++) assert.ok(edge[i] > edge[i - 1] - 0.6, `step ${i} goes backwards`)
})
