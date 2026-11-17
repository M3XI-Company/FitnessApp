import test from 'node:test'
import assert from 'node:assert/strict'
import { achievements, yesterdayLine } from '../src/lib/achievements'
import { CHAT_LIMIT, chatFull, chatIsOld } from '../src/lib/chat'
import { coachContext, toChatMessage } from '../src/lib/coachApi'
import { addDays, todayKey } from '../src/lib/date'
import { chatMood, moodOfText } from '../src/lib/mood'
import { effectiveTargets } from '../src/lib/nutrition'
import { WEEKDAYS, weekdayOf } from '../src/lib/routine'
import type { AppState, ChatMessage, Profile, RoutineDay, Weekday } from '../src/lib/types'

const profile: Profile = { name: 'Sam', sex: 'male', age: 30, heightCm: 180, weightKg: 82, targetWeightKg: 77, activity: 'moderate', goal: 'lose', onboarded: true }
const TRAIN: RoutineDay = { title: 'Full body', focus: 'Everything', items: [{ exerciseId: 'squat', sets: 1, reps: '5–8' }] }
const state = (extra: Partial<AppState> = {}): AppState => ({
  profile, targets: effectiveTargets(profile), food: [], water: {}, sets: [], weights: [], goals: [],
  waterPlan: { goalMl: 2000, glassMl: 250 } as unknown as AppState['waterPlan'], boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
  routine: { days: Object.fromEntries(WEEKDAYS.map((d) => [d, TRAIN])) as Record<Weekday, RoutineDay>, source: 'coach' } as AppState['routine'],
  ...extra,
} as AppState)
const say = (role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: text, role, text, ...extra })
const empty = { reply: 'ok', update_routine: false, routine_days: [], update_meal_plan: false, meal_days: [] }

test('the mood is read from what the user says', () => {
  assert.equal(moodOfText('my shoulder hurts when I press'), 'gentle')
  assert.equal(moodOfText('I finished it, new PB on squat'), 'proud')
  assert.equal(moodOfText("let's go, start my workout"), 'fired_up')
  assert.equal(moodOfText('thanks, that went well'), 'upbeat')
  assert.equal(moodOfText('what is for dinner'), undefined)
})

test('the latest thing said sets the mood of the chat', () => {
  assert.equal(chatMood([]), 'calm')
  assert.equal(chatMood([say('user', 'hi'), say('coach', 'Well done', { mood: 'proud' })]), 'proud')
  // a new message from the user changes it before the reply arrives
  assert.equal(chatMood([say('coach', 'Well done', { mood: 'proud' }), say('user', 'but my knee is sore now')]), 'gentle')
  // a neutral message leaves the coach's last mood in place
  assert.equal(chatMood([say('coach', 'Ready?', { mood: 'fired_up' }), say('user', 'what time is it')]), 'fired_up')
  assert.equal(chatMood([say('coach', 'Here is your workout', { guide: todayKey() })]), 'fired_up')
})

test('the coach names a mood with a reply, and anything else is ignored', () => {
  assert.equal(toChatMessage({ ...empty, mood: 'gentle' }).mood, 'gentle')
  assert.equal(toChatMessage({ ...empty, mood: 'furious' }).mood, undefined)
  assert.equal(toChatMessage(empty).mood, undefined)
})

test('a chat is cut off at its limit and at the end of the day', () => {
  const chat = Array.from({ length: CHAT_LIMIT }, (_, i) => say(i % 2 ? 'coach' : 'user', `m${i}`))
  assert.equal(chatFull(state({ chat })), true)
  assert.equal(chatFull(state({ chat: chat.slice(1) })), false)
  const today = todayKey()
  assert.equal(chatIsOld(state({ chat: chat.slice(0, 2), chatDay: addDays(today, -1) }), today), true)
  assert.equal(chatIsOld(state({ chat: chat.slice(0, 2), chatDay: today }), today), false)
  assert.equal(chatIsOld(state({ chat: [], chatDay: addDays(today, -1) }), today), false)
})

test('earlier days are remembered as achievements and passed to the coach', () => {
  const today = todayKey()
  const yesterday = addDays(today, -1)
  const s = state({
    sets: [
      { id: 'a', date: addDays(today, -30), exerciseId: 'squat', weight: 50, reps: 8 },
      { id: 'b', date: yesterday, exerciseId: 'squat', weight: 60, reps: 6 },
    ],
    weights: [{ date: addDays(today, -40), kg: 85 }, { date: yesterday, kg: 82 }],
  })
  const lines = achievements(s, today)
  assert.ok(lines.some((l) => l === 'Yesterday: finished Full body'), lines.join(' | '))
  assert.ok(lines.some((l) => /^New best on .*: 60 kg for 6/.test(l)), lines.join(' | '))
  assert.ok(lines.some((l) => l.startsWith('Body weight 85 kg to 82 kg')), lines.join(' | '))
  assert.equal(yesterdayLine(s, today), 'Yesterday you finished Full body.')
  assert.deepEqual(coachContext(s).recent_achievements, lines)
  assert.deepEqual(achievements(state(), today), [])
  assert.equal(yesterdayLine(state(), today), undefined)
  assert.ok(weekdayOf(today))
})
