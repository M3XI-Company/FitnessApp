import test from 'node:test'
import assert from 'node:assert/strict'
import { heardProgress, understand, type HeardProfile } from '../src/lib/interview'
import type { Profile } from '../src/lib/types'

const base: Profile = { name: '', sex: 'male', age: 29, heightCm: 178, weightKg: 82, targetWeightKg: 76, activity: 'moderate', goal: 'lose', onboarded: false }
const heard = (patch: Partial<HeardProfile> = {}): HeardProfile => ({ name: 'Sam', age: 31, sex: 'female', height_cm: 177.8, weight_kg: 82.6, target_weight_kg: 0, goal: 'lose', activity: 'sedentary', ...patch })

test('everything said in the conversation becomes the profile', () => {
  const u = understand(base, heard(), '  Trains  twice a week.\nNo fish. ')
  assert.deepEqual(u.missing, [])
  assert.equal(u.underAge, false)
  assert.equal(u.profile.name, 'Sam')
  assert.equal(u.profile.age, 31)
  assert.equal(u.profile.sex, 'female')
  assert.equal(u.profile.heightCm, 178)
  assert.equal(u.profile.weightKg, 82.5)
  assert.equal(u.profile.activity, 'sedentary')
  assert.equal(u.profile.notes, 'Trains twice a week. No fish.')
  assert.equal(understand(base, heard(), 'Sam works shifts. Samantha is a friend.').profile.notes, 'They works shifts. Samantha is a friend.')
  // nothing is switched on by the conversation itself
  assert.equal(u.profile.onboarded, false)
})

test('what was not said is reported as missing and keeps the starting value', () => {
  const u = understand(base, { name: '', age: 0, sex: 'unknown', height_cm: 0, weight_kg: 0, target_weight_kg: 0, goal: 'unknown', activity: 'unknown' })
  assert.deepEqual(u.missing, ['name', 'age', 'sex', 'height', 'weight', 'goal', 'activity'])
  assert.equal(u.profile.age, 29)
  assert.equal(u.profile.heightCm, 178)
  assert.equal(u.profile.notes, undefined)
  assert.deepEqual(understand(base, undefined).missing.length, 7)
})

test('mis-heard numbers are not believed', () => {
  const u = understand(base, heard({ age: 3, height_cm: 1778, weight_kg: 800 }))
  assert.deepEqual(u.missing, ['age', 'height', 'weight'])
  assert.equal(u.profile.age, 29)
  assert.equal(u.profile.weightKg, 82)
  assert.equal(understand(base, heard({ age: Number.NaN })).missing.includes('age'), true)
})

test('an age under 16 is flagged and never saved', () => {
  const u = understand(base, heard({ age: 14 }))
  assert.equal(u.underAge, true)
  assert.equal(u.profile.age, 29)
  assert.ok(u.missing.includes('age'))
  assert.equal(understand(base, heard({ age: 16 })).underAge, false)
})

test('the target weight always agrees with the goal', () => {
  assert.equal(understand(base, heard({ goal: 'lose', target_weight_kg: 75 })).profile.targetWeightKg, 75)
  // a "lose" target above the current weight is a mis-hearing: fall back to a modest one
  assert.equal(understand(base, heard({ goal: 'lose', target_weight_kg: 90 })).profile.targetWeightKg, 77.5)
  assert.equal(understand(base, heard({ goal: 'lose' })).profile.targetWeightKg, 77.5)
  assert.equal(understand(base, heard({ goal: 'gain' })).profile.targetWeightKg, 86.5)
  assert.equal(understand(base, heard({ goal: 'gain', target_weight_kg: 88 })).profile.targetWeightKg, 88)
  assert.equal(understand(base, heard({ goal: 'maintain', target_weight_kg: 70 })).profile.targetWeightKg, 82.5)
})

test('names are cleaned up and anything that is not a name is dropped', () => {
  assert.equal(understand(base, heard({ name: '  Mary-Jane O\'Neil  ' })).profile.name, 'Mary-Jane O\'Neil')
  assert.equal(understand(base, heard({ name: 'Zoë' })).profile.name, 'Zoë')
  assert.equal(understand(base, heard({ name: '<b>Sam</b> 123' })).profile.name, 'bSamb')
  assert.ok(understand(base, heard({ name: '12345' })).missing.includes('name'))
})

test('progress follows how much is known', () => {
  assert.equal(heardProgress(undefined), 0)
  assert.equal(heardProgress(heard()), 1)
  assert.ok(Math.abs(heardProgress(heard({ sex: 'unknown', activity: 'unknown' })) - 5 / 7) < 1e-9)
})
