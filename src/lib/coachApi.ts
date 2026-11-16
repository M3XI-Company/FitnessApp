/**
 * Client for the AI coach Edge Function (supabase/functions/coach).
 *
 * Sends the recent conversation and a compact picture of the user (no name,
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
import { addDays, todayKey, uid } from './date'
import { deviceId } from './foodPhoto'
import { dayMacros, workoutsThisWeek } from './progress'
import { allRecipes, recipeById } from './recipes'
import { mealsFor } from './chat'
import { WEEKDAYS, dayProgress, routineFor, routineStreak, sanitiseRoutine, weekdayOf } from './routine'
import type { AppState, ChatMessage, Weekday } from './types'

export type CoachError = 'not_configured' | 'monthly_limit' | 'declined' | 'offline' | 'busy' | 'failed'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const coachConfigured = () => !!(URL_BASE && ANON)

const HISTORY = 16
const MAX_CHARS = 2000

interface ServerResult {
  reply: string
  update_routine: boolean
  routine_days: { day: Weekday; title: string; focus: string; items: { exercise_id: string; sets: number; reps: string }[] }[]
  update_meal_plan: boolean
  meal_days: { day: Weekday; recipe_ids: string[] }[]
  /** a card to show under the reply; absent from older deployments of the function */
  show?: 'none' | 'today' | 'tomorrow' | 'workout'
}

/** What the coach is told about the user. Deliberately leaves out the name and anything free-text. */
export function coachContext(s: AppState) {
  const p = s.profile
  const routine = routineFor(s)
  const today = dayMacros(s, todayKey())
  return {
    profile: { sex: p.sex, age: p.age, height_cm: p.heightCm, weight_kg: p.weightKg, target_weight_kg: p.targetWeightKg, goal: p.goal, activity: p.activity },
    daily_targets: s.targets,
    eaten_today: { kcal: Math.round(today.kcal), protein_g: Math.round(today.protein) },
    current_routine: WEEKDAYS.map((d) => ({ day: d, title: routine.days[d].title, exercises: routine.days[d].items.map((i) => `${i.exerciseId} ${i.sets}x${i.reps}`) })),
    consistency: { workouts_last_7_days: workoutsThisWeek(s), routine_streak_days: routineStreak(s), sessions_logged: new Set(s.sets.map((x) => x.date)).size },
    today: weekdayOf(todayKey()),
    todays_workout: (() => { const d = dayProgress(s); return { title: d.day.title, status: d.status, exercises_done: d.doneItems, exercises_total: d.items.length } })(),
    // what the day cards in the chat currently show
    meals_today: mealsFor(s, todayKey()).recipes.map((r) => r.recipe.id),
    meals_tomorrow: mealsFor(s, addDays(todayKey(), 1)).recipes.map((r) => r.recipe.id),
    // from a photo the user chose to take; a trainer's first-look description, not a measurement
    ...(s.bodyScan ? { body_scan: { build: s.bodyScan.build, muscle_development: s.bodyScan.muscle, posture_notes: s.bodyScan.posture, focus_areas: s.bodyScan.focusAreas, confidence: s.bodyScan.confidence } } : {}),
    exercises: EXERCISES.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, equipment: e.equipment, level: e.level })),
    recipes: allRecipes().map((r) => ({ id: r.recipe.id, name: r.recipe.title, kcal: Math.round(r.perServing.kcal), protein: Math.round(r.perServing.protein) })),
  }
}

/** Dates for the coming week, keyed by weekday, starting today. */
const comingWeek = () => Object.fromEntries(Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i)).map((d) => [weekdayOf(d), d])) as Record<Weekday, string>

/** Turn the server's answer into a chat message, keeping only proposals that pass the app's own checks. */
export function toChatMessage(r: ServerResult, s?: AppState): ChatMessage {
  const msg: ChatMessage = { id: uid(), role: 'coach', text: r.reply.trim() }
  if (r.show === 'today') msg.day = todayKey()
  else if (r.show === 'tomorrow') msg.day = addDays(todayKey(), 1)
  // only when there is a workout left to do today
  else if (r.show === 'workout' && s && ['todo', 'started'].includes(dayProgress(s).status)) msg.guide = todayKey()
  if (r.update_routine) {
    const routine = sanitiseRoutine({ days: Object.fromEntries(r.routine_days.map((d) => [d.day, { title: d.title, focus: d.focus, items: d.items.map((i) => ({ exerciseId: i.exercise_id, sets: i.sets, reps: i.reps })) }])) }, 'coach')
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
export async function askCoach(s: AppState, chat: ChatMessage[]): Promise<{ ok: true; message: ChatMessage; remaining?: number } | { ok: false; error: CoachError; limit?: number }> {
  if (!coachConfigured()) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 90000)
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/coach`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({
        device: await deviceId(),
        messages: chat.slice(-HISTORY).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) })).filter((m) => m.text),
        context: coachContext(s),
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, message: toChatMessage(body as ServerResult, s), remaining: body.remaining }
    if (res.status === 429) return { ok: false, error: 'monthly_limit', limit: body.limit }
    if (res.status === 422) return { ok: false, error: 'declined' }
    if (res.status === 503) return { ok: false, error: 'busy' }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
