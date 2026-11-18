import test from 'node:test'
import assert from 'node:assert/strict'
import { elizaFallback, elizaHandle, elizaSay, elizaTask, reflect } from '../src/lib/eliza'
import { todayKey } from '../src/lib/date'
import { effectiveTargets } from '../src/lib/nutrition'
import { WEEKDAYS, buildRoutine } from '../src/lib/routine'
import type { AppState, Profile, RoutineDay, Weekday } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 80, targetWeightKg: 78, activity: 'moderate', goal: 'maintain', onboarded: true } as Profile
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 3, reps: '5–8' }] }
const state = (extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { startHour: 8, endHour: 21, glassMl: 250 }, boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  favourites: [], savedMeals: [], mealCategories: [], demo: false,
  routine: { ...buildRoutine(profile), days: Object.fromEntries(WEEKDAYS.map((d) => [d, TRAIN])) as Record<Weekday, RoutineDay> },
  ...extra,
} as AppState)

test('ELIZA takes the plain jobs and leaves the rest for the AI coach', () => {
  assert.equal(elizaTask('start my workout'), 'start')
  assert.equal(elizaTask('tomorrow?'), 'tomorrow')
  assert.equal(elizaTask('reminders'), 'reminders')
  assert.equal(elizaTask('How much water have I had today?'), 'water')
  assert.equal(elizaTask('how many calories do I have left?'), 'food')
  assert.equal(elizaTask('protein left'), 'food')
  // these take understanding
  assert.equal(elizaTask('Should I drink more water when I train in the heat?'), null)
  assert.equal(elizaTask('my knee hurts when I squat, what should I change?'), null)
  assert.equal(elizaTask('swap tomorrow for a rest day'), null)
  assert.equal(elizaTask('how many calories are in a banana'), null)
})

test('a job is done from the user\'s own numbers, with no wait', () => {
  const s = state({ water: { [todayKey()]: 500 } })
  const water = elizaHandle(s, 'how much water have I had today?')
  assert.ok(water && water.role === 'coach' && water.text.includes('500 ml'))
  const start = elizaHandle(s, "let's go")
  assert.equal(start?.guide, todayKey())
  assert.equal(elizaHandle(s, 'I have been feeling flat all week and I am not sure the plan suits me'), null)
})

test('what was said is turned to face the speaker', () => {
  assert.equal(reflect('my knees and I am worried'), 'your knees and you are worried')
  assert.equal(reflect('get to the gym.'), 'get to the gym')
})

test('the highest-ranked keyword decides the reply, and the sentence is put back together', () => {
  assert.equal(elizaSay("I can't get to the gym", 0), 'What makes you feel you can’t get to the gym?')
  assert.equal(elizaSay('I feel stuck with my weight', 0), 'What do you think is making you feel stuck with your weight?')
  // pain outranks everything a sentence might also contain
  assert.ok(elizaSay('my shoulder hurts and I feel lazy').includes('GP'))
  assert.ok(elizaSay('I want to kill myself').includes('116 123'))
})

test('the same thing said twice is not answered the same way twice, and nothing is left unanswered', () => {
  assert.notEqual(elizaSay('I am so tired', 0), elizaSay('I am so tired', 1))
  assert.ok(elizaSay('xyzzy').length > 5)
  for (const line of ['hello', 'thanks', 'no', 'because work is busy', 'my sleep is bad', 'I always skip Mondays']) assert.ok(!elizaSay(line).includes('$1'))
})

test('without the AI coach, numbers come from the app and matters of safety get fixed words', () => {
  const s = state()
  assert.ok(elizaFallback(s, 'what should I eat, I am hungry').text.includes('kcal'))
  assert.ok(elizaFallback(s, 'I feel a sharp pain in my back when I eat').text.includes('GP'))
  assert.equal(elizaFallback(s, "I can't face the gym").text, 'What makes you feel you can’t face the gym?')
})
