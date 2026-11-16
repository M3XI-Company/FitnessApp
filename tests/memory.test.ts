import test from 'node:test'
import assert from 'node:assert/strict'
import { checkinMessage, needsCheckin } from '../src/lib/chat'
import { coachContext, detailsChange, memoryChange, toChatMessage } from '../src/lib/coachApi'
import { todayKey } from '../src/lib/date'
import { MAX_MEMORIES, MAX_MEMORY_CHARS, addMemories, forgetMemories, memoryForCoach, notesToMemories } from '../src/lib/memory'
import { effectiveTargets } from '../src/lib/nutrition'
import { WEEKDAYS, buildRoutine } from '../src/lib/routine'
import type { AppState, MemoryItem, Profile, RoutineDay, Weekday } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 82, targetWeightKg: 77, activity: 'moderate', goal: 'lose', onboarded: true }
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 1, reps: '5–8' }] }
const state = (extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { startHour: 8, endHour: 21, glassMl: 250 }, boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  favourites: [], savedMeals: [], mealCategories: [], demo: false,
  routine: { ...buildRoutine(profile), days: Object.fromEntries(WEEKDAYS.map((d) => [d, TRAIN])) as Record<Weekday, RoutineDay> },
  ...extra,
})
const today = todayKey()
const base = { reply: 'ok', update_routine: false, routine_days: [], update_meal_plan: false, meal_days: [] }

test('new facts are remembered newest first, once each', () => {
  const when = new Date('2026-11-16T10:00:00Z')
  const a = addMemories([], ['Trains at home with dumbbells.', '  Left shoulder   ached on bench press. '], when)
  assert.deepEqual(a.map((m) => m.text), ['Left shoulder ached on bench press.', 'Trains at home with dumbbells.'])
  assert.equal(a[0].at, when.toISOString())
  assert.equal(new Set(a.map((m) => m.id)).size, 2)
  // the same fact said again, with different capitals and punctuation, is not stored twice
  const b = addMemories(a, ['trains at home with dumbbells', 'Does not eat fish.'])
  assert.deepEqual(b.map((m) => m.text), ['Does not eat fish.', 'Left shoulder ached on bench press.', 'Trains at home with dumbbells.'])
})

test('junk is not remembered, long facts are cut, and the oldest are let go', () => {
  assert.equal(addMemories([], ['', '  ', '..', 42, null, undefined]).length, 0)
  assert.equal(addMemories([], ['x'.repeat(500)])[0].text.length, MAX_MEMORY_CHARS)
  const many = addMemories([], Array.from({ length: MAX_MEMORIES + 5 }, (_, i) => `Fact number ${i}`))
  assert.equal(many.length, MAX_MEMORIES)
  assert.equal(many[0].text, `Fact number ${MAX_MEMORIES + 4}`)
  assert.ok(!many.some((m) => m.text === 'Fact number 0'))
})

test('facts can be forgotten one at a time', () => {
  const a = addMemories([], ['One fact.', 'Another fact.'])
  assert.deepEqual(forgetMemories(a, [a[0].id]).map((m) => m.text), ['One fact.'])
  assert.equal(forgetMemories(a, ['nope']).length, 2)
})

test('a conversation\'s notes become one fact per sentence', () => {
  assert.deepEqual(notesToMemories('Works shifts. Trains at home! Is 5 a.m. too early? Yes'), ['Works shifts.', 'Trains at home!', 'Is 5 a.m.', 'too early?', 'Yes'])
  assert.deepEqual(notesToMemories(undefined), [])
  assert.deepEqual(notesToMemories('  '), [])
})

test('the coach is sent its memory with dates and ids, and never the name', () => {
  const memory = addMemories([], ['They work shifts.', 'Left knee is sore on lunges.'], new Date('2026-11-10T09:00:00Z'))
  const ctx = coachContext(state({ memory })) as Record<string, unknown>
  assert.deepEqual(ctx.memory, memoryForCoach(state({ memory })))
  assert.deepEqual((ctx.memory as { noted: string }[])[0].noted, '2026-11-10')
  assert.equal(JSON.stringify(ctx).includes('Sam'), false)
  assert.equal('memory' in (coachContext(state()) as Record<string, unknown>), false)
  // a full memory still fits what the function accepts
  const full = addMemories([], Array.from({ length: MAX_MEMORIES }, (_, i) => `${i} ${'word '.repeat(40)}`))
  assert.ok(JSON.stringify(coachContext(state({ memory: full }))).length < 24000)
})

test('what the coach asks to remember and forget is checked before it is applied', () => {
  const memory: MemoryItem[] = addMemories([], ['Left shoulder ached on bench press.'])
  const s = state({ memory })
  const change = memoryChange(s, { remember: ['Shoulder is fine now.', '', '  '], forget: [memory[0].id, 'made-up-id'] })
  assert.deepEqual(change, { remember: ['Shoulder is fine now.'], forget: [memory[0].id] })
  assert.deepEqual(memoryChange(s, {}), { remember: [], forget: [] })
  assert.equal(memoryChange(s, { remember: ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `${x} fact`) }).remember.length, 4)
  // what was noted is shown under the reply
  assert.deepEqual(toChatMessage({ ...base, remember: ['Shoulder is fine now.'] }, s).noted, ['Shoulder is fine now.'])
  assert.equal(toChatMessage(base, s).noted, undefined)
})

test('a details change keeps only what is believable and different', () => {
  const s = state()
  const none = { weight_kg: 0, target_weight_kg: 0, goal: 'unchanged', activity: 'unchanged' }
  assert.equal(detailsChange(s, none), undefined)
  assert.equal(detailsChange(s, undefined), undefined)
  assert.deepEqual(detailsChange(s, { ...none, weight_kg: 80.2 }), { weightKg: 80 })
  // the same weight, or one that is plainly a mistake, is not a change
  assert.equal(detailsChange(s, { ...none, weight_kg: 82 }), undefined)
  assert.equal(detailsChange(s, { ...none, weight_kg: 8 }), undefined)
  assert.equal(detailsChange(s, { ...none, weight_kg: 120 }), undefined)
  assert.deepEqual(detailsChange(s, { ...none, goal: 'gain', activity: 'active' }), { goal: 'gain', activity: 'active' })
  assert.equal(detailsChange(s, { ...none, goal: 'lose', activity: 'moderate' }), undefined)
  assert.equal(detailsChange(s, { ...none, goal: 'shred' }), undefined)
  // a target must point the same way as the goal
  assert.deepEqual(detailsChange(s, { ...none, target_weight_kg: 75 }), { targetWeightKg: 75 })
  assert.equal(detailsChange(s, { ...none, target_weight_kg: 90 }), undefined)
  assert.deepEqual(detailsChange(s, { ...none, goal: 'gain', target_weight_kg: 90 }), { goal: 'gain', targetWeightKg: 90 })
  assert.deepEqual(toChatMessage({ ...base, update_details: { ...none, weight_kg: 80 } }, s).details, { weightKg: 80 })
})

test('after the guided workout is finished, the coach asks how it went, once', () => {
  const done = [{ id: 's1', date: today, exerciseId: 'squat', weight: 60, reps: 5 }]
  const guide = { id: 'g', role: 'coach' as const, text: 'Let\'s go', guide: today }
  // not finished yet
  assert.equal(needsCheckin(state({ chat: [guide] }), today), false)
  // finished, but the coach was not guiding it in this chat
  assert.equal(needsCheckin(state({ sets: done }), today), false)
  assert.equal(needsCheckin(state({ sets: done, chat: [guide] }), today), true)
  const asked = checkinMessage(today)
  assert.equal(asked.checkin, today)
  assert.equal(needsCheckin(state({ sets: done, chat: [guide, asked] }), today), false)
})
