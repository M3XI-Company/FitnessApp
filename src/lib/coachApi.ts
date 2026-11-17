/**
 * Client for the AI coach Edge Function (supabase/functions/coach).
 *
 * Sends the conversation (a chat is at most a day and 60 messages long, so
 * all of it) and a compact picture of the user (no name,
 * no photos) and gets back a reply and, when the user asked for one, a
 * proposed weekly routine and meal plan, or a card to show (the day's plan or
 * the guided workout). Every proposal is validated here
 * against the app's own exercise and recipe lists and limits before it is
 * shown, and nothing changes until the user taps "Use this plan".
 *
 * Configure with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Without them the app falls back to the on-device rule-based coach.
 */
import { EXERCISES } from '../data/exercises'
import { achievements } from './achievements'
import { addDays, todayKey, uid } from './date'
import { deviceId } from './foodPhoto'
import { EASE_IN_SESSIONS, dayMacros, easingIn, sessionsDone, workoutsThisWeek } from './progress'
import { allRecipes, recipeById } from './recipes'
import { mealsFor } from './chat'
import { LIMITS } from './interview'
import { postForOutcome } from './stream'
import { MAX_MEMORY_CHARS, memoryForCoach, memoryOf } from './memory'
import { isMood } from './mood'
import { remindersOf, sanitiseTimes } from './reminders'
import { WEEKDAYS, dayProgress, routineFor, routineStreak, sanitiseRoutine, weekdayOf } from './routine'
import type { Activity, AppState, ChatMessage, DetailsChange, GoalType, Weekday } from './types'

export type CoachError = 'not_configured' | 'monthly_limit' | 'declined' | 'offline' | 'busy' | 'failed'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const coachConfigured = () => !!(URL_BASE && ANON)

/** A whole chat fits: see CHAT_LIMIT. */
const HISTORY = 60
const MAX_CHARS = 2000

interface ServerResult {
  reply: string
  update_routine: boolean
  routine_days: { day: Weekday; title: string; focus: string; style?: string; items: { exercise_id: string; sets: number; reps: string }[] }[]
  update_meal_plan: boolean
  meal_days: { day: Weekday; recipe_ids: string[] }[]
  /** a card to show under the reply; absent from older deployments of the function */
  show?: 'none' | 'today' | 'tomorrow' | 'workout'
  /** reminder times the coach suggests, as "HH:MM" */
  set_reminders?: boolean
  reminder_times?: { breakfast: string; lunch: string; dinner: string; workout: string }
  /** new facts for the coach's memory, and ids of remembered facts that are no longer true */
  remember?: string[]
  forget?: string[]
  /** a change to the user's details; 0 and "unchanged" mean leave as it is */
  update_details?: { weight_kg: number; target_weight_kg: number; goal: string; activity: string }
  /** how the conversation is going, which sets the look of the orb */
  mood?: string
}

/** What a reply asks the app to do to the coach's memory. Applied straight away: the user can see and delete it. */
export interface MemoryChange { remember: string[]; forget: string[] }

/** What the coach is told about the user. Deliberately leaves out the name and anything free-text. */
export function coachContext(s: AppState) {
  const p = s.profile
  const routine = routineFor(s)
  const today = dayMacros(s, todayKey())
  return {
    profile: { sex: p.sex, age: p.age, height_cm: p.heightCm, weight_kg: p.weightKg, target_weight_kg: p.targetWeightKg, goal: p.goal, activity: p.activity },
    daily_targets: s.targets,
    eaten_today: { kcal: Math.round(today.kcal), protein_g: Math.round(today.protein) },
    current_routine: WEEKDAYS.map((d) => ({ day: d, title: routine.days[d].title, ...(routine.days[d].style ? { style: routine.days[d].style } : {}), exercises: routine.days[d].items.map((i) => `${i.exerciseId} ${i.sets}x${i.reps}`) })),
    consistency: { workouts_last_7_days: workoutsThisWeek(s), routine_streak_days: routineStreak(s), sessions_logged: new Set(s.sets.map((x) => x.date)).size },
    today: weekdayOf(todayKey()),
    todays_workout: (() => { const d = dayProgress(s); return { title: d.day.title, ...(d.day.style ? { style: d.day.style } : {}), status: d.status, exercises_done: d.doneItems, exercises_total: d.items.length } })(),
    // the first few sessions are kept light, and each ends with the user saying how it felt
    easing_in: easingIn(s) ? { sessions_done: sessionsDone(s), light_sessions_in_total: EASE_IN_SESSIONS } : false,
    // what the day cards in the chat currently show
    meals_today: mealsFor(s, todayKey()).recipes.map((r) => r.recipe.id),
    meals_tomorrow: mealsFor(s, addDays(todayKey(), 1)).recipes.map((r) => r.recipe.id),
    reminders: remindersOf(s),
    // what the user has done lately, from the app's records: a new chat starts each day, so this is how earlier days are known
    recent_achievements: achievements(s),
    // what the coach has learned about the user so far, in its own words
    ...(memoryOf(s).length ? { memory: memoryForCoach(s) } : {}),
    // from a photo the user chose to take; a trainer's first-look description, not a measurement
    ...(s.bodyScan ? { body_scan: { build: s.bodyScan.build, muscle_development: s.bodyScan.muscle, posture_notes: s.bodyScan.posture, focus_areas: s.bodyScan.focusAreas, confidence: s.bodyScan.confidence } } : {}),
    exercises: EXERCISES.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, equipment: e.equipment, level: e.level })),
    recipes: allRecipes().map((r) => ({ id: r.recipe.id, name: r.recipe.title, kcal: Math.round(r.perServing.kcal), protein: Math.round(r.perServing.protein) })),
  }
}

const half = (kg: number) => Math.round(kg * 2) / 2
const ok = (v: unknown, [lo, hi]: readonly [number, number]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/**
 * The part of a suggested details change that is believable and actually
 * different from what the app has. A weight more than 15 kg away from the
 * current one is treated as a mistake, not a change.
 */
export function detailsChange(s: AppState, u: ServerResult['update_details']): DetailsChange | undefined {
  if (!u) return undefined
  const p = s.profile
  const out: DetailsChange = {}
  if (ok(u.weight_kg, LIMITS.weightKg) && Math.abs(u.weight_kg - p.weightKg) <= 15 && half(u.weight_kg) !== p.weightKg) out.weightKg = half(u.weight_kg)
  if ((['lose', 'maintain', 'gain'] as string[]).includes(u.goal) && u.goal !== p.goal) out.goal = u.goal as GoalType
  if ((['sedentary', 'light', 'moderate', 'active', 'athlete'] as string[]).includes(u.activity) && u.activity !== p.activity) out.activity = u.activity as Activity
  const goal = out.goal ?? p.goal
  const weight = out.weightKg ?? p.weightKg
  // a target is only taken when it points the same way as the goal
  if (ok(u.target_weight_kg, LIMITS.weightKg) && half(u.target_weight_kg) !== p.targetWeightKg && ((goal === 'lose' && u.target_weight_kg < weight) || (goal === 'gain' && u.target_weight_kg > weight))) out.targetWeightKg = half(u.target_weight_kg)
  return Object.keys(out).length ? out : undefined
}

/** What a reply asks the app to remember and forget; forgetting is limited to facts the app actually holds. */
export function memoryChange(s: AppState, r: Pick<ServerResult, 'remember' | 'forget'>): MemoryChange {
  const held = new Set(memoryOf(s).map((m) => m.id))
  return {
    remember: (r.remember ?? []).filter((t) => typeof t === 'string' && t.trim()).slice(0, 4),
    forget: (r.forget ?? []).filter((id) => held.has(id)),
  }
}

/** Dates for the coming week, keyed by weekday, starting today. */
const comingWeek = () => Object.fromEntries(Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i)).map((d) => [weekdayOf(d), d])) as Record<Weekday, string>

/** Turn the server's answer into a chat message, keeping only proposals that pass the app's own checks. */
export function toChatMessage(r: ServerResult, s?: AppState): ChatMessage {
  const msg: ChatMessage = { id: uid(), role: 'coach', text: r.reply.trim() }
  if (isMood(r.mood)) msg.mood = r.mood
  if (r.show === 'today') msg.day = todayKey()
  else if (r.show === 'tomorrow') msg.day = addDays(todayKey(), 1)
  // only when there is a workout left to do today
  else if (r.show === 'workout' && s && ['todo', 'started'].includes(dayProgress(s).status)) msg.guide = todayKey()
  const remember = (r.remember ?? []).filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, MAX_MEMORY_CHARS)).slice(0, 4)
  if (remember.length) msg.noted = remember
  const details = s ? detailsChange(s, r.update_details) : undefined
  if (details) msg.details = details
  // shown as a card to adjust; nothing is scheduled until the user turns reminders on
  if (r.set_reminders && r.reminder_times) msg.reminders = sanitiseTimes(r.reminder_times, s ? remindersOf(s).times : undefined)
  if (r.update_routine) {
    const routine = sanitiseRoutine({ days: Object.fromEntries(r.routine_days.map((d) => [d.day, { title: d.title, focus: d.focus, style: d.style, items: d.items.map((i) => ({ exerciseId: i.exercise_id, sets: i.sets, reps: i.reps })) }])) }, 'coach')
    if (routine) msg.routine = routine
  }
  if (r.update_meal_plan) {
    const dates = comingWeek()
    const meals: Record<string, string[]> = {}
    for (const d of r.meal_days) {
      const ids = [...new Set(d.recipe_ids)].filter((id) => recipeById(id)).slice(0, 4)
      if (ids.length && dates[d.day]) meals[dates[d.day]] = ids
    }
    if (Object.keys(meals).length) msg.meals = meals
  }
  return msg
}

/** Ask the connected coach. `chat` is the conversation so far, ending with the user's new message. */
export async function askCoach(s: AppState, chat: ChatMessage[], onThinking?: (thinking: string) => void): Promise<{ ok: true; message: ChatMessage; memory: MemoryChange; remaining?: number } | { ok: false; error: CoachError; limit?: number }> {
  if (!coachConfigured()) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 120000)
  try {
    const { status, body } = await postForOutcome(`${URL_BASE}/functions/v1/coach`,
      { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      {
        device: await deviceId(),
        messages: chat.slice(-HISTORY).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) })).filter((m) => m.text),
        context: coachContext(s),
      },
      // the coach's thinking, as it happens
      (event, data) => { if (event === 'thinking' && typeof data.text === 'string') onThinking?.(data.text) },
      ctrl.signal)
    const r = body as unknown as ServerResult & { remaining?: number; limit?: number }
    if (status === 200 && typeof r.reply === 'string') return { ok: true, message: toChatMessage(r, s), memory: memoryChange(s, r), remaining: r.remaining }
    if (status === 429) return { ok: false, error: 'monthly_limit', limit: r.limit }
    if (status === 422) return { ok: false, error: 'declined' }
    if (status === 503) return { ok: false, error: 'busy' }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
