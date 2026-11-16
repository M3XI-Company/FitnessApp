import test from 'node:test'
import assert from 'node:assert/strict'
import { localAnswer, localIntent, mealPlanText, mealsFor, portionFor, restSeconds, sessionMinutes, suggestMeals } from '../src/lib/chat'
import { coachContext, toChatMessage } from '../src/lib/coachApi'
import { addDays, todayKey } from '../src/lib/date'
import { effectiveTargets } from '../src/lib/nutrition'
import { allRecipes } from '../src/lib/recipes'
import { WEEKDAYS, buildRoutine, weekdayOf } from '../src/lib/routine'
import type { AppState, Profile, RoutineDay, Weekday } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetWeightKg: 78, activity: 'moderate', goal: 'maintain', onboarded: true }
const REST: RoutineDay = { title: 'Rest day', focus: 'Recovery', items: [] }
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 3, reps: '5–8' }, { exerciseId: 'plank', sets: 2, reps: '30 s' }] }

/** A state whose routine trains on every day except the ones named as rest. */
const state = (rest: Weekday[] = [], extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { startHour: 8, endHour: 21, glassMl: 250 }, boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  favourites: [], savedMeals: [], mealCategories: [], demo: false,
  routine: { ...buildRoutine(profile), days: Object.fromEntries(WEEKDAYS.map((d) => [d, rest.includes(d) ? REST : TRAIN])) as Record<Weekday, RoutineDay> },
  ...extra,
})
const today = todayKey()
const doneToday = () => state([], { sets: [1, 2, 3].map((i) => ({ id: `s${i}`, date: today, exerciseId: 'squat', weight: 60, reps: 5 })).concat([1, 2].map((i) => ({ id: `p${i}`, date: today, exerciseId: 'plank', weight: 0, reps: 30 }))) })

test('rest is longer for heavy barbell lifts than for core work', () => {
  assert.equal(restSeconds('squat'), 150)
  assert.equal(restSeconds('plank'), 45)
  assert.equal(restSeconds('not-an-exercise'), 90)
})

test('session length is rounded to five minutes and grows with the work', () => {
  assert.equal(sessionMinutes([]), 0)
  const short = sessionMinutes(TRAIN.items)
  const long = sessionMinutes([...TRAIN.items, { exerciseId: 'bench', sets: 4 }, { exerciseId: 'row', sets: 4 }])
  assert.equal(short % 5, 0)
  assert.ok(long > short)
  // 3 x (45 + 150) + 2 x (45 + 45) seconds = 12.75 min, plus a 5 min warm-up
  assert.equal(short, 20)
})

test('suggested meals are three different recipes, stable for a date and not over the calorie target', () => {
  const t = { kcal: 2200, protein: 150 }
  const a = suggestMeals(t, '2026-11-16')
  assert.equal(a.length, 3)
  assert.equal(new Set(a.map((r) => r.recipe.id)).size, 3)
  assert.deepEqual(suggestMeals(t, '2026-11-16').map((r) => r.recipe.id), a.map((r) => r.recipe.id))
  assert.ok(a.reduce((x, r) => x + r.perServing.kcal, 0) <= t.kcal * 1.05)
})

test('a week of suggestions is not the same three meals every day', () => {
  const t = { kcal: 2200, protein: 150 }
  const days = Array.from({ length: 7 }, (_, i) => suggestMeals(t, addDays('2026-11-16', i)).map((r) => r.recipe.id).sort().join(','))
  assert.ok(new Set(days).size >= 3)
})

test('the user’s own meal plan wins over a suggestion', () => {
  const ids = allRecipes().slice(0, 2).map((r) => r.recipe.id)
  const planned = mealsFor(state([], { boxedPlan: { [today]: [...ids, 'not-a-recipe'] } }), today)
  assert.equal(planned.planned, true)
  assert.deepEqual(planned.recipes.map((r) => r.recipe.id), ids)
  const suggested = mealsFor(state(), today)
  assert.equal(suggested.planned, false)
  assert.equal(suggested.recipes.length, 3)
})

test('portions bring the day up to the calorie target without going over it', () => {
  const three = allRecipes().slice(0, 3)
  const kcal = three.reduce((a, r) => a + r.perServing.kcal, 0)
  assert.equal(portionFor({ kcal }, three), 1)
  assert.equal(portionFor({ kcal: kcal * 1.6 }, three), 1.5)
  assert.equal(portionFor({ kcal: kcal * 5 }, three), 2)
  assert.equal(portionFor({ kcal: kcal * 0.5 }, three), 1)
  const day = mealsFor(state(), today)
  assert.ok(day.kcal <= state().targets.kcal)
  assert.ok(day.kcal >= state().targets.kcal * 0.7, `${day.kcal} of ${state().targets.kcal}`)
})

test('the copied meal plan lists every meal with its ingredients in grams', () => {
  const meals = mealsFor(state(), today)
  const text = mealPlanText([meals])
  for (const r of meals.recipes) {
    assert.ok(text.includes(r.recipe.title))
    assert.ok(text.includes(r.ingredients[0].label))
  }
  assert.match(text, /\d+ g /)
  assert.match(text, /\d+ kcal, \d+ g protein/)
})

test('only short, plain asks are answered on the phone', () => {
  assert.equal(localIntent('Start my workout'), 'start')
  assert.equal(localIntent('I am starting my workout routine now'), 'start')
  assert.equal(localIntent('Continue my workout'), 'start')
  assert.equal(localIntent('Tomorrow'), 'tomorrow')
  assert.equal(localIntent("What's on tomorrow?"), 'tomorrow')
  assert.equal(localIntent('today'), 'today')
  // these need the coach
  assert.equal(localIntent('What should I eat today?'), null)
  assert.equal(localIntent('Can I do more next week?'), null)
  assert.equal(localIntent('Should I start a new routine?'), null)
  assert.equal(localIntent('Change my meals'), null)
  assert.equal(localIntent('Reminders'), 'reminders')
  assert.equal(localIntent('set up my reminders'), 'reminders')
  assert.equal(localIntent('Remind me to eat breakfast at 7'), null)
})

test('starting a workout opens the guide only when there is one to do', () => {
  assert.equal(localAnswer(state(), 'start', today).guide, today)
  assert.equal(localAnswer(state([weekdayOf(today)]), 'start', today).guide, undefined)
  assert.equal(localAnswer(doneToday(), 'start', today).guide, undefined)
  assert.equal(localAnswer(state(), 'tomorrow', today).day, addDays(today, 1))
  assert.equal(localAnswer(state(), 'today', today).day, today)
})

test('the coach can show a card, and cannot start a workout that is not there', () => {
  const base = { reply: 'ok', update_routine: false, routine_days: [], update_meal_plan: false, meal_days: [] }
  assert.equal(toChatMessage({ ...base, show: 'today' }, state()).day, today)
  assert.equal(toChatMessage({ ...base, show: 'tomorrow' }, state()).day, addDays(today, 1))
  assert.equal(toChatMessage({ ...base, show: 'workout' }, state()).guide, today)
  assert.equal(toChatMessage({ ...base, show: 'workout' }, state([weekdayOf(today)])).guide, undefined)
  const none = toChatMessage({ ...base, show: 'none' }, state())
  assert.equal(none.day, undefined)
  assert.equal(none.guide, undefined)
  // an older function that does not send `show`
  assert.equal(toChatMessage(base, state()).day, undefined)
})

test('what the coach is told stays inside the function’s size limit', () => {
  const ctx = coachContext(state())
  assert.equal(ctx.meals_today.length, 3)
  assert.equal(ctx.todays_workout.exercises_total, 2)
  assert.ok(JSON.stringify(ctx).length < 16000, `context is ${JSON.stringify(ctx).length} chars`)
})
