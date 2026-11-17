/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { exerciseById } from '../src/data/exercises'
import { addDays, todayKey } from '../src/lib/date'
import { formTips } from '../src/lib/fit'
import { ROUTINE_LIMITS, WEEKDAYS, buildRoutine, dayProgress, repsFor, routineStreak, sanitiseRoutine, weekdayOf } from '../src/lib/routine'
import { quickFind } from '../src/lib/search'
import { easingIn, nextTarget, startingWeight } from '../src/lib/progress'
import type { AppState, BodyScan, Profile, SetLog, WeeklyRoutine } from '../src/lib/types'

/** the figures listed in the generated map, read as text because it requires image files */
const EXERCISE_ART_FILES: Record<string, string[]> = Object.fromEntries(
  [...readFileSync('src/data/exerciseArt.ts', 'utf8').matchAll(/^  '([^']+)': \{(.*)\},$/gm)].map((m) => [m[1], [...m[2].matchAll(/assets\/exercise\/([a-z0-9_]+\.jpg)/g)].map((x) => x[1])]),
)
const profile = (over: Partial<Profile> = {}): Profile => ({ name: '', sex: 'male', age: 30, heightCm: 178, weightKg: 80, targetWeightKg: 76, activity: 'moderate', goal: 'maintain', onboarded: true, ...over })
const state = (over: Partial<AppState> = {}): AppState => ({ profile: profile(), sets: [], ...over } as AppState)
const log = (date: string, exerciseId: string, n: number): SetLog[] => Array.from({ length: n }, (_, i) => ({ id: `${date}${exerciseId}${i}`, date, exerciseId, weight: 20, reps: 8 }))
/** every set of every exercise planned for that date */
const finish = (routine: WeeklyRoutine, date: string) => routine.days[weekdayOf(date)].items.flatMap((it) => log(date, it.exerciseId, it.sets))

test('starting routine: training days follow activity level and only use real exercises', () => {
  for (const [activity, days] of [['sedentary', 3], ['light', 3], ['moderate', 4], ['active', 5], ['athlete', 5]] as const) {
    const r = buildRoutine(profile({ activity }))
    const training = WEEKDAYS.filter((d) => r.days[d].items.length)
    assert.equal(training.length, days, activity)
    for (const d of training) for (const it of r.days[d].items) assert.ok(exerciseById(it.exerciseId), `${it.exerciseId} exists`)
  }
})

test('starting routine: fat-loss adds a conditioning finisher, muscle gain adds a set to the main lifts', () => {
  const base = buildRoutine(profile()).days.mon.items
  const lose = buildRoutine(profile({ goal: 'lose' })).days.mon.items
  const gain = buildRoutine(profile({ goal: 'gain' })).days.mon.items
  assert.equal(lose.length, base.length + 1)
  assert.equal(exerciseById(lose.at(-1)!.exerciseId)?.muscle, 'Cardio')
  assert.equal(gain[0].sets, 4)
  // dumbbell and bodyweight moves keep three sets; only the heavy lifts of a strength day get a fourth
  assert.equal(base.find((i) => i.exerciseId === 'cable-fly')?.sets, 3)
})

test('every training day works a different part of the body, on strength and volume days', () => {
  for (const activity of ['light', 'moderate', 'active'] as const) {
    const days = WEEKDAYS.map((d) => buildRoutine(profile({ activity })).days[d]).filter((d) => d.items.length)
    assert.equal(new Set(days.map((d) => d.title)).size, days.length, `${activity}: every day has its own body part`)
    assert.ok(days.some((d) => d.style === 'strength') && days.some((d) => d.style === 'volume'), `${activity}: has both kinds of day`)
    for (const d of days) {
      assert.ok(d.style, `${d.title} has a style`)
      const heavy = d.items.filter((i) => ['bench', 'squat', 'row', 'ohp', 'rdl', 'leg-press', 'lat-pulldown'].includes(i.exerciseId))
      for (const i of heavy) assert.equal(i.reps, d.style === 'strength' ? '4–6' : '12–15', `${i.exerciseId} on a ${d.style} day`)
    }
  }
  assert.equal(repsFor('plank', 'strength'), '30–60')
  assert.equal(repsFor('curl', 'volume'), '12–15')
  assert.equal(repsFor('curl', 'strength'), '6–10')
})

test('weights follow the kind of day and start light for the first sessions', () => {
  const day = (n: number) => addDays(todayKey(), -n)
  const fresh = state()
  const first = nextTarget(fresh, 'bench', { reps: '4–6', style: 'strength' })!
  const settled = state({ sets: [1, 2, 3].map((n) => ({ id: `s${n}`, date: day(n * 2), exerciseId: 'plank', weight: 0, reps: 30 })) })
  const later = nextTarget(settled, 'bench', { reps: '4–6', style: 'strength' })!
  assert.equal(easingIn(fresh), true)
  assert.equal(easingIn(settled), false)
  assert.ok(first.weight < later.weight, `${first.weight} is lighter than ${later.weight}`)
  assert.match(first.note, /light on purpose/)
  assert.ok(nextTarget(settled, 'bench', { reps: '12–15', style: 'volume' })!.weight < later.weight, 'a volume day starts lighter than a strength day')
  // a lift that was done for many reps is worked out again, heavier, when it moves to a strength day
  const volume = state({ sets: [{ id: 'v', date: day(3), exerciseId: 'bench', weight: 40, reps: 15 }] })
  const heavy = nextTarget(volume, 'bench', { reps: '4–6', style: 'strength' })!
  assert.ok(heavy.weight > 40 && heavy.reps === 4, `${heavy.weight} kg for ${heavy.reps}`)
  // and inside a range it is double progression as before
  const hit = state({ sets: [{ id: 'h', date: day(3), exerciseId: 'bench', weight: 60, reps: 6 }] })
  assert.equal(nextTarget(hit, 'bench', { reps: '4–6', style: 'strength' })!.weight, 62.5)
})

test('form tips fit the person, and say nothing when nothing calls for a change', () => {
  const tall = formTips('squat', { ...profile(), sex: 'male', heightCm: 192 })
  assert.match(tall[0], /long legs/i)
  const woman = formTips('squat', { ...profile(), sex: 'female', heightCm: 165 })
  assert.match(woman[0], /pelvis/i)
  assert.deepEqual(formTips('squat', { ...profile(), sex: 'male', heightCm: 178, age: 30 }), [])
  const scan = { at: '', build: 'average', muscle: 'developing', posture: ['Slightly rounded shoulders'], focusAreas: [], summary: '', confidence: 'medium' } as BodyScan
  assert.match(formTips('bench', { ...profile(), sex: 'male', heightCm: 178 }, scan)[0], /shoulder blades/i)
  assert.ok(formTips('squat', { ...profile(), sex: 'female', heightCm: 180, age: 60 }).length <= 2)
  assert.deepEqual(formTips('not-real', profile()), [])
})

test('a proposed routine is cleaned up before use', () => {
  const r = sanitiseRoutine({
    days: {
      mon: { title: 'Push', focus: 'Chest', items: [{ exerciseId: 'bench', sets: 12, reps: '5-8' }, { exerciseId: 'not-real', sets: 3, reps: '8-12' }, { exerciseId: 'bench', sets: 3, reps: '8-12' }, { exerciseId: 'pushup', sets: 0, reps: 'lots' }] },
      tue: { title: '', items: [{ exerciseId: 'not-real', sets: 3 }] },
    },
  }, 'coach')!
  assert.deepEqual(r.days.mon.items.map((i) => i.exerciseId), ['bench', 'pushup'], 'unknown and repeated exercises are dropped')
  assert.equal(r.days.mon.items[0].sets, ROUTINE_LIMITS.maxSets, 'sets are capped')
  assert.equal(r.days.mon.items[0].reps, '5–8')
  assert.equal(r.days.mon.items[1].sets, 3, 'missing sets fall back to 3')
  assert.match(r.days.mon.items[1].reps, /^\d+–\d+$/, 'an unusable rep label falls back to the exercise default')
  assert.equal(r.days.tue.items.length, 0, 'a day with nothing usable becomes a rest day')
  assert.equal(r.source, 'coach')
})

test('a proposed routine always keeps a rest day, and an empty one is rejected', () => {
  const everyDay = Object.fromEntries(WEEKDAYS.map((d) => [d, { title: 'Daily', items: [{ exerciseId: 'pushup', sets: 3 }] }]))
  const r = sanitiseRoutine({ days: everyDay }, 'coach')!
  assert.equal(WEEKDAYS.filter((d) => !r.days[d].items.length).length, ROUTINE_LIMITS.minRestDays)
  assert.equal(sanitiseRoutine({ days: {} }, 'coach'), null)
})

test('a day is done only when every set of every exercise is ticked', () => {
  const routine = buildRoutine(profile())
  // the next date that is a training day
  let date = todayKey()
  while (!routine.days[weekdayOf(date)].items.length) date = addDays(date, -1)
  const items = routine.days[weekdayOf(date)].items
  assert.equal(dayProgress(state({ routine }), date).status, 'todo')
  assert.equal(dayProgress(state({ routine, sets: log(date, items[0].exerciseId, 1) }), date).status, 'started')
  const done = dayProgress(state({ routine, sets: finish(routine, date) }), date)
  assert.equal(done.status, 'done')
  assert.equal(done.doneItems, items.length)
})

test('streak counts finished days, lets rest days ride along, and breaks on a missed day', () => {
  const routine = buildRoutine(profile({ activity: 'active' })) // rest on Thu and Sun
  const today = todayKey()
  assert.equal(routineStreak(state({ routine })), 0)

  // finish every training day for the last 10 days up to yesterday; today is still open
  const sets: SetLog[] = []
  for (let i = 1; i <= 10; i++) sets.push(...finish(routine, addDays(today, -i)))
  const run = routineStreak(state({ routine, sets }))
  const todayIsRest = !routine.days[weekdayOf(today)].items.length
  // rest days at the oldest end of the run have no finished day before them to anchor them, so they do not count
  let expected = 10
  for (let i = 10; !routine.days[weekdayOf(addDays(today, -i))].items.length; i--) expected--
  assert.equal(run, expected, todayIsRest ? 'today is a rest day' : 'today not finished yet does not break the run')

  // skip one training day in the middle: only the days after it count
  let gap = 4
  while (!routine.days[weekdayOf(addDays(today, -gap))].items.length) gap++
  const withGap = sets.filter((x) => x.date !== addDays(today, -gap))
  assert.ok(routineStreak(state({ routine, sets: withGap })) < gap)
})

test('first-session weights come from body weight and stay conservative', () => {
  const s = state()
  assert.equal(startingWeight(s, 'pushup'), 0, 'bodyweight exercises have no load')
  const bench = startingWeight(s, 'bench')
  assert.ok(bench >= 20 && bench <= 40, `bench ${bench}`)
  assert.equal(bench % exerciseById('bench')!.step, 0, 'rounded to the plate step')
  assert.ok(startingWeight(state({ profile: profile({ sex: 'female' }) }), 'squat') < startingWeight(s, 'squat'))
  assert.equal(startingWeight(state({ profile: profile({ weightKg: 40 }) }), 'ohp'), 20, 'never below an empty bar')
})

test('quick find: names first, typos tolerated, every typed word must match', () => {
  const items = ['Bench Press', 'Barbell Curl', 'Hammer Curl', 'Back Squat', 'Seated DB Shoulder Press']
  const find = (q: string) => quickFind(q, items, (x) => [x])
  assert.deepEqual(find(''), items)
  assert.equal(find('ben')[0], 'Bench Press')
  assert.deepEqual(find('curl'), ['Barbell Curl', 'Hammer Curl'])
  assert.deepEqual(find('sholder'), ['Seated DB Shoulder Press'])
  assert.deepEqual(find('hammer curl'), ['Hammer Curl'])
  assert.deepEqual(find('xyz'), [])
})

test('exercise figures are real files for real exercises', () => {
  for (const [id, art] of Object.entries(EXERCISE_ART_FILES)) {
    assert.ok(exerciseById(id), `${id} is an exercise`)
    for (const file of art) assert.ok(existsSync(`assets/exercise/${file}`), `${file} exists`)
  }
  assert.ok(Object.keys(EXERCISE_ART_FILES).length >= 8)
})
