import test from 'node:test'
import assert from 'node:assert/strict'
import { toChatMessage } from '../src/lib/coachApi'
import { addDays, todayKey } from '../src/lib/date'
import { effectiveTargets } from '../src/lib/nutrition'
import { allRecipes } from '../src/lib/recipes'
import { DAYS_AHEAD, DEFAULT_TIMES, REPEATS, formatTime, parseTime, planKey, planReminders, remindersMessage, sanitiseTimes, sayTime, shiftTime } from '../src/lib/reminders'
import { WEEKDAYS, buildRoutine, weekdayOf } from '../src/lib/routine'
import type { AppState, Profile, ReminderSettings, RoutineDay, Weekday } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetWeightKg: 78, activity: 'moderate', goal: 'maintain', onboarded: true }
const REST: RoutineDay = { title: 'Rest day', focus: 'Recovery', items: [] }
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 3, reps: '5–8' }] }
const ON: ReminderSettings = { on: true, repeat: true, times: DEFAULT_TIMES }

const state = (reminders: ReminderSettings | undefined, rest: Weekday[] = [], extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { startHour: 8, endHour: 21, glassMl: 250 }, boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  favourites: [], savedMeals: [], mealCategories: [], demo: false, reminders,
  routine: { ...buildRoutine(profile), days: Object.fromEntries(WEEKDAYS.map((d) => [d, rest.includes(d) ? REST : TRAIN])) as Record<Weekday, RoutineDay> },
  ...extra,
})
const today = todayKey()
/** very early today, so every reminder for today is still ahead */
const dawn = new Date(`${today}T00:30:00`)

test('times are read, written and said the way people say them', () => {
  assert.equal(parseTime('08:00'), 480)
  assert.equal(parseTime('7:05'), 425)
  assert.equal(parseTime('24:00'), null)
  assert.equal(parseTime('half seven'), null)
  assert.equal(parseTime(undefined), null)
  assert.equal(formatTime(425), '07:05')
  assert.equal(sayTime('18:30'), '6:30 pm')
  assert.equal(sayTime('08:00'), '8 am')
  assert.equal(sayTime('12:00'), '12 pm')
  assert.equal(shiftTime('08:00', 15), '08:15')
  assert.equal(shiftTime('00:05', -15), '00:00')
  assert.equal(shiftTime('23:45', 15), '23:45')
})

test('times from the coach are made safe: bad ones fall back, meals stay in order', () => {
  assert.deepEqual(sanitiseTimes({ breakfast: '07:00', lunch: 'noon', dinner: '19:00', workout: '06:15' }), { breakfast: '07:00', lunch: '12:30', dinner: '19:00', workout: '06:15' })
  // lunch before breakfast and dinner on top of lunch are pushed apart
  const t = sanitiseTimes({ breakfast: '09:00', lunch: '08:00', dinner: '11:30', workout: '17:00' })
  assert.equal(t.breakfast, '09:00')
  assert.equal(t.lunch, '11:00')
  assert.equal(t.dinner, '13:00')
  assert.deepEqual(sanitiseTimes(undefined), DEFAULT_TIMES)
})

test('nothing is scheduled until reminders are turned on', () => {
  assert.deepEqual(planReminders(state(undefined), dawn), [])
  assert.deepEqual(planReminders(state({ ...ON, on: false }), dawn), [])
})

test('a week is planned, naming each day\'s meal and workout', () => {
  const s = state({ ...ON, repeat: false })
  const plan = planReminders(s, dawn)
  // three meals and a workout a day
  assert.equal(plan.length, DAYS_AHEAD * 4)
  assert.equal(new Set(plan.map((p) => p.id)).size, plan.length)
  assert.ok(plan.every((p, i) => !i || plan[i - 1].at <= p.at))
  const first = plan[0]
  assert.equal(first.slot, 'breakfast')
  assert.equal(first.at.getHours(), 8)
  assert.ok(allRecipes().some((r) => first.title === `Breakfast: ${r.recipe.title}`))
  assert.match(first.body, /kcal, \d+ g protein/)
  const workout = plan.find((p) => p.slot === 'workout')!
  assert.equal(workout.title, 'Time to train: Full body')
})

test('rest days and finished workouts get no workout reminder', () => {
  const rest = planReminders(state({ ...ON, repeat: false }, [weekdayOf(today)]), dawn)
  assert.equal(rest.filter((p) => p.slot === 'workout' && p.id.startsWith(today)).length, 0)
  assert.equal(rest.filter((p) => p.slot === 'workout').length, DAYS_AHEAD - 1)
  const done = state({ ...ON, repeat: false }, [], { sets: [1, 2, 3].map((i) => ({ id: `s${i}`, date: today, exerciseId: 'squat', weight: 60, reps: 5 })) })
  assert.equal(planReminders(done, dawn).filter((p) => p.slot === 'workout' && p.id.startsWith(today)).length, 0)
})

test('reminders already past are not planned, and follow-up pings stop once their reminder has fired', () => {
  const s = state(ON)
  const all = planReminders(s, dawn)
  // today and tomorrow: each of the four reminders is followed by two pings
  assert.equal(all.length, DAYS_AHEAD * 4 + 2 * 4 * REPEATS)
  const breakfastPings = all.filter((p) => p.id.startsWith(`${today}-breakfast`))
  assert.deepEqual(breakfastPings.map((p) => p.at.getMinutes()), [0, 10, 20])
  assert.match(breakfastPings[1].title, /^Reminder: Breakfast/)
  // opened at 08:05, after breakfast fired: its pings are gone, lunch is untouched
  const after = planReminders(s, new Date(`${today}T08:05:00`))
  assert.equal(after.filter((p) => p.id.startsWith(`${today}-breakfast`)).length, 0)
  assert.equal(after.filter((p) => p.id.startsWith(`${today}-lunch`)).length, 1 + REPEATS)
  // far ahead days carry no pings
  assert.equal(all.filter((p) => p.id.startsWith(addDays(today, 3)) && p.repeat > 0).length, 0)
})

test('the plan stays under the phone\'s limit of 64 scheduled notifications', () => {
  assert.ok(planReminders(state(ON), dawn).length <= 64)
})

test('the fingerprint changes when the plan does', () => {
  const a = planKey(planReminders(state(ON), dawn))
  assert.equal(a, planKey(planReminders(state(ON), dawn)))
  assert.notEqual(a, planKey(planReminders(state({ ...ON, times: { ...DEFAULT_TIMES, lunch: '13:00' } }), dawn)))
})

test('the coach can suggest times, which are shown as a card and checked first', () => {
  const base = { reply: 'ok', update_routine: false, routine_days: [], update_meal_plan: false, meal_days: [] }
  const times = { breakfast: '07:00', lunch: '12:00', dinner: '18:00', workout: '25:99' }
  const s = state(ON)
  assert.deepEqual(toChatMessage({ ...base, set_reminders: true, reminder_times: times }, s).reminders, { breakfast: '07:00', lunch: '12:00', dinner: '18:00', workout: DEFAULT_TIMES.workout })
  assert.equal(toChatMessage({ ...base, set_reminders: false, reminder_times: times }, s).reminders, undefined)
  assert.equal(toChatMessage(base, s).reminders, undefined)
  assert.deepEqual(remindersMessage(s).reminders, DEFAULT_TIMES)
})
