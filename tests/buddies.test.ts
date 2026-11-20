import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agoLine, joinBlocker, jointDay, levelFromSets, shownName, whereLine, type JointPlan } from '../src/lib/buddyRules'
import { afterSend, recordChanges } from '../src/lib/recordChanges'
import type { SetLog } from '../src/lib/types'

const set = (id: string, demo = false): SetLog => ({ id, date: '2026-11-20', exerciseId: 'squat', weight: 60, reps: 8, ...(demo ? { demo } : {}) })

test('partner search is for adults who have chosen a gym', () => {
  const place = { id: 'osm1', lat: 51.5, lon: -0.12 }
  assert.equal(joinBlocker({ age: 17, gym: 'Gym', gymPlace: place }), 'age')
  assert.equal(joinBlocker({ age: 18, gym: undefined, gymPlace: undefined }), 'gym')
  // a gym typed by hand has no position to measure from
  assert.equal(joinBlocker({ age: 30, gym: 'Gym', gymPlace: undefined }), 'gym')
  assert.equal(joinBlocker({ age: 30, gym: 'Gym', gymPlace: place }), null)
})

test('other people see a first name and a rounded distance', () => {
  assert.equal(shownName('  Sam   Taylor '), 'Sam')
  assert.equal(whereLine({ gym: 'Harbour Gym', km: 1, same_gym: true }), 'Harbour Gym · your gym')
  assert.equal(whereLine({ gym: 'Harbour Gym', km: 3, same_gym: false }), 'Harbour Gym · about 3 km away')
  assert.equal(whereLine({ gym: 'Harbour Gym', km: null, same_gym: false }), 'Harbour Gym')
})

test('level is guessed from real sets only', () => {
  assert.equal(levelFromSets(Array.from({ length: 500 }, (_, i) => set(`d${i}`, true))), 'beginner')
  assert.equal(levelFromSets(Array.from({ length: 80 }, (_, i) => set(`r${i}`))), 'intermediate')
  assert.equal(levelFromSets(Array.from({ length: 401 }, (_, i) => set(`r${i}`))), 'advanced')
})

test('a shared session becomes a day of the routine', () => {
  const plan: JointPlan = {
    title: 'Morning Full-Body Builder', when: 'A weekday morning.', why: 'Suits you both.', at: '2026-11-20T10:00:00Z',
    items: [{ exercise_id: 'squat', sets: 3, reps: '8-10', together: 'Take turns.' }, { exercise_id: 'bench', sets: 9, reps: '8-10', together: 'Spot each other.' }],
  }
  const day = jointDay(plan, 'Sam')
  assert.equal(day.title, 'Morning Full-Body Builder')
  assert.equal(day.focus, 'With Sam')
  assert.deepEqual(day.items, [{ exerciseId: 'squat', sets: 3, reps: '8-10' }, { exerciseId: 'bench', sets: 5, reps: '8-10' }])
})

test('message times read short', () => {
  const now = Date.parse('2026-11-20T12:00:00Z')
  assert.equal(agoLine('2026-11-20T11:59:50Z', now), 'now')
  assert.equal(agoLine('2026-11-20T11:40:00Z', now), '20 min ago')
  assert.equal(agoLine('2026-11-20T09:00:00Z', now), '3 h ago')
})

test('each set is sent to the database once, and deleted ones are removed', () => {
  const sets = [set('a'), set('b'), set('demo', true)]
  const first = recordChanges(sets, [])
  assert.deepEqual(first.add.map((s) => s.id), ['a', 'b'])
  assert.deepEqual(first.remove, [])
  const sent = afterSend([], first)
  assert.deepEqual(recordChanges(sets, sent), { add: [], remove: [] })
  const later = recordChanges([set('b'), set('c')], sent)
  assert.deepEqual(later.add.map((s) => s.id), ['c'])
  assert.deepEqual(later.remove, ['a'])
  assert.deepEqual(afterSend(sent, later), ['b', 'c'])
})
