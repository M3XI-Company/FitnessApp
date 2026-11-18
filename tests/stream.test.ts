import test from 'node:test'
import assert from 'node:assert/strict'
import { daySchedule, mealsFor, plainText, thinkingLine } from '../src/lib/chat'
import { todayKey } from '../src/lib/date'
import { gymDistance, gymLabel, gymWhere } from '../src/lib/gyms'
import { heardTags } from '../src/lib/interview'
import { effectiveTargets } from '../src/lib/nutrition'
import { DEFAULT_TIMES } from '../src/lib/reminders'
import { WEEKDAYS, buildRoutine, weekdayOf } from '../src/lib/routine'
import { parseSse } from '../src/lib/stream'
import type { AppState, Profile, RoutineDay, Weekday } from '../src/lib/types'

test('server-sent events are split into whole events, keeping the unfinished tail', () => {
  const { events, rest } = parseSse('event: thinking\ndata: {"text":"a"}\n\nevent: result\ndata: {"status":200}\n\nevent: thi')
  assert.deepEqual(events, [{ event: 'thinking', data: '{"text":"a"}' }, { event: 'result', data: '{"status":200}' }])
  assert.equal(rest, 'event: thi')
  assert.deepEqual(parseSse('data: x\r\n\r\n').events, [{ event: 'message', data: 'x' }])
  assert.deepEqual(parseSse('').events, [])
})

test('the thinking line is plain, short and shows the latest thought', () => {
  assert.equal(thinkingLine('**Planning** the week.'), 'Planning the week.')
  const long = 'First I check their goal. Then I look at the routine they have. The shoulder note matters most here. So bench comes out and rows go first.'
  const line = thinkingLine(long, 80)
  assert.ok(line.length <= 80, line)
  assert.ok(line.endsWith('rows go first.'), line)
  assert.ok(!line.startsWith('First'), line)
  const unbroken = thinkingLine('x'.repeat(300), 50)
  assert.ok(unbroken.startsWith('…') && unbroken.length <= 50)
})

test('what has been understood is shown as short tags', () => {
  assert.deepEqual(heardTags(undefined), [])
  assert.deepEqual(heardTags({ name: 'Sam', age: 31, sex: 'unknown', height_cm: 177.8, weight_kg: 0, target_weight_kg: 0, goal: 'lose', activity: 'unknown' }), ['Sam', '31 years', '178 cm', 'Lose weight'])
})

test('gyms are described in one line and labelled so branches differ', () => {
  const g = { name: 'PureGym', address: '90-100 Market Street', town: 'Manchester', postcode: 'M1 1PB' }
  assert.equal(gymWhere(g), '90-100 Market Street, Manchester M1 1PB')
  assert.equal(gymWhere({ address: '', town: '', postcode: '' }), '')
  assert.equal(gymLabel(g), 'PureGym, Market Street')
  assert.equal(gymLabel({ name: 'The Gym', address: '', town: 'Leeds' }), 'The Gym, Leeds')
  assert.equal(gymDistance(null), '')
  assert.equal(gymDistance(0.23), '250 m')
  assert.equal(gymDistance(0.01), '50 m')
  assert.equal(gymDistance(2.44), '2.4 km')
})

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 82, targetWeightKg: 77, activity: 'moderate', goal: 'lose', onboarded: true }
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 1, reps: '5–8' }] }
const REST: RoutineDay = { title: 'Rest day', focus: 'Recovery', items: [] }
const state = (rest: Weekday[] = [], extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { startHour: 8, endHour: 21, glassMl: 250 }, boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  favourites: [], savedMeals: [], mealCategories: [], demo: false,
  routine: { ...buildRoutine(profile), days: Object.fromEntries(WEEKDAYS.map((d) => [d, rest.includes(d) ? REST : TRAIN])) as Record<Weekday, RoutineDay> },
  ...extra,
})
const today = todayKey()
/** A moment today at the given 24-hour time. */
const at = (time: string) => new Date(`${today}T${time}:00`)

test('the day is a schedule in time order, with the next thing to do', () => {
  const { items, next } = daySchedule(state(), today, today, at('07:00'))
  assert.deepEqual(items.map((i) => i.slot), ['breakfast', 'lunch', 'workout', 'dinner'])
  assert.deepEqual(items.map((i) => i.time), [DEFAULT_TIMES.breakfast, DEFAULT_TIMES.lunch, DEFAULT_TIMES.workout, DEFAULT_TIMES.dinner])
  assert.equal(next, 0)
  // the user's own times reorder it: a morning workout comes first
  const early = daySchedule(state([], { reminders: { on: false, repeat: true, times: { ...DEFAULT_TIMES, workout: '06:30' } } }), today, today)
  assert.equal(early.items[0].slot, 'workout')
})

test('eating breakfast and finishing the workout move "up next" along', () => {
  const s = state()
  const breakfast = mealsFor(s, today).recipes[0]
  const ate = state([], {
    food: [{ id: 'f', date: today, meal: 'breakfast', name: breakfast.recipe.title, serving: '1', qty: 1, kcal: 1, protein: 1, carbs: 1, fat: 1, source: 'search', dataSource: 'recipe' }],
  })
  const after = daySchedule(ate, today, today, at('09:00'))
  assert.equal(after.items[0].done, true)
  assert.equal(after.items[after.next].slot, 'lunch')
  // another day has nothing "up next"
  assert.equal(daySchedule(s, '2000-01-01', today).next, -1)
})

test('a rest day leads the row and is never "up next"', () => {
  const { items, next } = daySchedule(state([weekdayOf(today)]), today, today, at('07:00'))
  assert.equal(items[0].slot, 'rest')
  assert.equal(items[0].time, '')
  assert.notEqual(items[next].slot, 'rest')
})

test('by lunchtime an uneaten breakfast is missed and lunch is the thing to do now', () => {
  // breakfast 08:00, lunch 12:30, workout 17:00, dinner 18:30
  const morning = daySchedule(state(), today, today, at('07:00'))
  assert.deepEqual(morning.items.map((i) => i.state), ['next', 'later', 'later', 'later'])
  const breakfastTime = daySchedule(state(), today, today, at('08:40'))
  assert.deepEqual(breakfastTime.items.map((i) => i.state), ['now', 'later', 'later', 'later'])
  const lunchtime = daySchedule(state(), today, today, at('13:21'))
  assert.equal(lunchtime.items[lunchtime.next].slot, 'lunch')
  assert.deepEqual(lunchtime.items.map((i) => i.state), ['missed', 'now', 'later', 'later'])
})

test('a workout whose time has passed is never missed, and gives way to a meal that is due', () => {
  const evening = daySchedule(state(), today, today, at('18:10'))
  assert.equal(evening.items[evening.next].slot, 'dinner')
  assert.deepEqual(evening.items.map((i) => i.state), ['missed', 'missed', 'later', 'now'])
  // with only the workout due, the workout is the thing to do
  const s = state()
  const eaten = mealsFor(s, today).recipes.slice(0, 2).map((r, i) => ({ id: `f${i}`, date: today, meal: 'lunch' as const, name: r.recipe.title, serving: '1', qty: 1, kcal: 1, protein: 1, carbs: 1, fat: 1, source: 'search' as const, dataSource: 'recipe' as const }))
  const afternoon = daySchedule(state([], { food: eaten }), today, today, at('17:05'))
  assert.equal(afternoon.items[afternoon.next].slot, 'workout')
  assert.equal(afternoon.items[afternoon.next].state, 'now')
})

test('markup is taken out of a reply before it is read aloud', () => {
  assert.equal(plainText('# Right now\nEat the **lemon garlic chicken** now.\nDinner at **6:30 pm**.'), 'Right now\nEat the lemon garlic chicken now.\nDinner at 6:30 pm.')
  assert.equal(plainText('Nothing to change here.'), 'Nothing to change here.')
})
