import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answersText, cleanQuestions } from '../src/lib/questions'
import { foodDays, paceLine, projection, weekStart, weeklySessions, weightChange } from '../src/lib/stats'
import type { Profile, SetLog } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 29, heightCm: 178, weightKg: 82, targetWeightKg: 76, activity: 'moderate', goal: 'lose', onboarded: true }
const set = (id: string, date: string): SetLog => ({ id, date, exerciseId: 'squat', weight: 60, reps: 8 })

test('the projection walks from today’s weight to the target and stops there', () => {
  const pr = projection(profile, undefined, 16, '2026-11-20')
  assert.equal(pr.points[0], 82)
  assert.ok(pr.perWeek < 0)
  assert.ok(pr.points.every((kg, i) => i === 0 || kg <= pr.points[i - 1]), 'never goes back up')
  assert.ok(pr.points.every((kg) => kg >= 76), 'never below the target')
  assert.equal(pr.weeksToTarget, Math.ceil(-6 / pr.perWeek))
  assert.match(paceLine(pr, profile), /^About 0\.\d+ kg a week: 76 kg in \d+ weeks, around \d+ \w+\.$/)
})

test('someone holding their weight has no target date', () => {
  const steady = projection({ ...profile, goal: 'maintain', targetWeightKg: 82 })
  assert.equal(steady.weeksToTarget, null)
  assert.ok(steady.points.every((kg) => kg === 82))
  assert.match(paceLine(steady, { goal: 'maintain', targetWeightKg: 82 }), /steady/)
})

test('sessions are counted by week, Monday to Sunday, a day counting once', () => {
  // 20 November 2026 is a Friday
  assert.equal(weekStart('2026-11-20'), '2026-11-16')
  const sets = [set('a', '2026-11-16'), set('b', '2026-11-16'), set('c', '2026-11-18'), set('d', '2026-11-10'), set('e', '2026-09-01')]
  const weeks = weeklySessions({ sets }, 3, '2026-11-20')
  assert.deepEqual(weeks.map((w) => w.value), [0, 1, 2])
  assert.equal(weeks[2].label, 'Now')
  assert.equal(weeks[1].label, '9/11')
})

test('eating is shown a day at a time, with empty days as nothing', () => {
  const days = foodDays({ food: [{ id: 'f', date: '2026-11-19', meal: 'lunch', name: 'Rice bowl', serving: '1', qty: 1, kcal: 560, protein: 48, carbs: 58, fat: 13, source: 'search' }] }, 3, '2026-11-20')
  assert.deepEqual(days.map((d) => d.kcal), [0, 560, 0])
  assert.deepEqual(days.map((d) => d.label), ['W', 'T', 'F'])
})

test('weight change is from the first weigh-in to the latest', () => {
  assert.equal(weightChange({ weights: [{ date: '2026-11-01', kg: 84 }] }), 0)
  assert.equal(weightChange({ weights: [{ date: '2026-11-15', kg: 82.6 }, { date: '2026-11-01', kg: 84 }] }), -1.4)
})

test('questions from the coach are tidied, and the answers go back as a message', () => {
  const qs = cleanQuestions([
    { question: '  How many days a week can you train? ', options: ['2', '3', '3', '4', ''] },
    { question: 'Where do you train?', options: ['Gym'] },
    { question: 'How many days a week can you train?', options: ['1', '2'] },
    'nonsense',
    { question: 'Where do you train?', options: ['Gym', 'Home', 7] },
  ])
  assert.deepEqual(qs, [{ question: 'How many days a week can you train?', options: ['2', '3', '4'] }, { question: 'Where do you train?', options: ['Gym', 'Home'] }])
  assert.equal(answersText(qs, { 0: '4', 1: 'Gym' }), 'How many days a week can you train: 4\nWhere do you train: Gym')
  assert.deepEqual(cleanQuestions(undefined), [])
})
