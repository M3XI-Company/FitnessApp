/**
 * The weekly routine: which exercises the user does on which day.
 *
 * A routine is first built from the onboarding profile (buildRoutine) and can
 * be replaced by one the AI coach proposes. Either way the routine only names
 * exercises, sets and rep ranges: the weight for each set always comes from
 * the progression rules in lib/progress, never from the routine.
 */
import { exerciseById } from '../data/exercises'
import { addDays, todayKey, uid } from './date'
import type { AppState, Profile, RoutineDay, RoutineItem, Weekday, WeeklyRoutine } from './types'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABEL: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

/** Limits every routine has to stay inside, wherever it came from */
export const ROUTINE_LIMITS = { maxItemsPerDay: 8, minSets: 1, maxSets: 5, minRestDays: 1 }

export const weekdayOf = (dateKey: string): Weekday => WEEKDAYS[(new Date(`${dateKey}T12:00:00`).getDay() + 6) % 7]

const REST: RoutineDay = { title: 'Rest day', focus: 'Recovery', items: [] }

/** Day templates: exercise ids in the order they are done */
const TEMPLATES: Record<string, { title: string; focus: string; ids: string[] }> = {
  fullA: { title: 'Full body A', focus: 'Legs, chest, back', ids: ['goblet', 'incline-db', 'lat-pulldown', 'db-shoulder', 'plank'] },
  fullB: { title: 'Full body B', focus: 'Legs, push, pull', ids: ['leg-press', 'pushup', 'seated-row', 'glute-bridge', 'hammer'] },
  upperA: { title: 'Upper body A', focus: 'Chest, back, arms', ids: ['bench', 'row', 'db-shoulder', 'lat-pulldown', 'curl', 'pushdown'] },
  lowerA: { title: 'Lower body A', focus: 'Quads, hamstrings, core', ids: ['squat', 'rdl', 'leg-press', 'calf', 'plank'] },
  upperB: { title: 'Upper body B', focus: 'Shoulders, back, chest', ids: ['ohp', 'lat-pulldown', 'incline-db', 'seated-row', 'lateral', 'face-pull'] },
  lowerB: { title: 'Lower body B', focus: 'Glutes, hamstrings, quads', ids: ['hip-thrust', 'lunge', 'leg-curl', 'leg-ext', 'cable-crunch'] },
  push: { title: 'Push', focus: 'Chest, shoulders, triceps', ids: ['bench', 'ohp', 'incline-db', 'lateral', 'pushdown'] },
  pull: { title: 'Pull', focus: 'Back, biceps', ids: ['row', 'lat-pulldown', 'face-pull', 'curl', 'hammer'] },
  legs: { title: 'Legs', focus: 'Quads, hamstrings, calves', ids: ['squat', 'rdl', 'leg-press', 'calf', 'plank'] },
}

/** Which template falls on which day, by training days per week */
const SCHEDULES: Record<3 | 4 | 5, Partial<Record<Weekday, string>>> = {
  3: { mon: 'fullA', wed: 'fullB', fri: 'fullA' },
  4: { mon: 'upperA', tue: 'lowerA', thu: 'upperB', fri: 'lowerB' },
  5: { mon: 'push', tue: 'pull', wed: 'legs', fri: 'upperB', sat: 'lowerB' },
}
const DAYS_PER_WEEK: Record<Profile['activity'], 3 | 4 | 5> = { sedentary: 3, light: 3, moderate: 4, active: 5, athlete: 5 }
/** a short conditioning finisher on fat-loss plans, rotated through the week */
const FINISHERS = ['mountain', 'kb-swing', 'burpee']

const repLabel = (exerciseId: string) => { const ex = exerciseById(exerciseId); return ex ? `${ex.reps[0]}–${ex.reps[1]}` : '8–12' }

/** The starting routine for a profile: training days from activity level, emphasis from the goal. */
export function buildRoutine(profile: Profile): WeeklyRoutine {
  const schedule = SCHEDULES[DAYS_PER_WEEK[profile.activity] ?? 3]
  let trained = 0
  const days = Object.fromEntries(WEEKDAYS.map((d) => {
    const t = schedule[d] ? TEMPLATES[schedule[d]!] : null
    if (!t) return [d, REST]
    const ids = profile.goal === 'lose' ? [...t.ids, FINISHERS[trained % FINISHERS.length]] : t.ids
    trained++
    const items: RoutineItem[] = ids.map((id, i) => ({ exerciseId: id, sets: profile.goal === 'gain' && i < 2 ? 4 : 3, reps: repLabel(id) }))
    return [d, { title: t.title, focus: t.focus, items }]
  })) as Record<Weekday, RoutineDay>
  return { id: uid(), createdAt: new Date().toISOString(), source: 'profile', days }
}

/**
 * Make any proposed routine safe to use: unknown exercises are dropped, sets
 * and day length are clamped, a rep label is always present, and at least one
 * rest day is kept. Returns null when nothing usable is left.
 */
export function sanitiseRoutine(input: { days: Partial<Record<Weekday, { title?: string; focus?: string; items?: { exerciseId: string; sets: number; reps?: string }[] }>> }, source: WeeklyRoutine['source']): WeeklyRoutine | null {
  const days = Object.fromEntries(WEEKDAYS.map((d) => {
    const raw = input.days[d]
    const seen = new Set<string>()
    const items: RoutineItem[] = (raw?.items ?? [])
      .filter((it) => exerciseById(it.exerciseId) && !seen.has(it.exerciseId) && seen.add(it.exerciseId))
      .slice(0, ROUTINE_LIMITS.maxItemsPerDay)
      .map((it) => ({
        exerciseId: it.exerciseId,
        sets: Math.max(ROUTINE_LIMITS.minSets, Math.min(ROUTINE_LIMITS.maxSets, Math.round(it.sets) || 3)),
        reps: it.reps && /^\d{1,3}(\s?[–-]\s?\d{1,3})?(\s?s)?$/.test(it.reps.trim()) ? it.reps.trim().replace(/\s?-\s?/, '–') : repLabel(it.exerciseId),
      }))
    if (!items.length) return [d, REST]
    return [d, { title: (raw?.title ?? '').trim().slice(0, 40) || 'Workout', focus: (raw?.focus ?? '').trim().slice(0, 60), items }]
  })) as Record<Weekday, RoutineDay>
  const training = WEEKDAYS.filter((d) => days[d].items.length)
  if (!training.length) return null
  // keep the minimum rest: the last training days of the week become rest days
  for (let i = training.length - 1; WEEKDAYS.length - training.length < ROUTINE_LIMITS.minRestDays && i >= 0; i--) { days[training[i]] = REST; training.pop() }
  return { id: uid(), createdAt: new Date().toISOString(), source, days }
}

/** The routine in use: the saved one, or the starting routine for this profile. */
export const routineFor = (s: AppState): WeeklyRoutine => s.routine ?? buildRoutine(s.profile)

export interface ItemProgress extends RoutineItem { done: number; complete: boolean }
export interface DayProgress { date: string; weekday: Weekday; day: RoutineDay; items: ItemProgress[]; doneItems: number; status: 'rest' | 'todo' | 'started' | 'done' }

/** What is planned for a date and how much of it has been ticked off. */
export function dayProgress(s: AppState, date = todayKey(), routine = routineFor(s)): DayProgress {
  const weekday = weekdayOf(date)
  const day = routine.days[weekday]
  const items = day.items.map((it) => {
    const done = s.sets.filter((x) => x.date === date && x.exerciseId === it.exerciseId).length
    return { ...it, done: Math.min(done, it.sets), complete: done >= it.sets }
  })
  const doneItems = items.filter((i) => i.complete).length
  const status = !items.length ? 'rest' : doneItems === items.length ? 'done' : items.some((i) => i.done) ? 'started' : 'todo'
  return { date, weekday, day, items, doneItems, status }
}

/** Monday to Sunday of the week containing `date`. */
export function weekProgress(s: AppState, date = todayKey()): DayProgress[] {
  const routine = routineFor(s)
  const monday = addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)))
  return WEEKDAYS.map((_, i) => dayProgress(s, addDays(monday, i), routine))
}

/**
 * Days in a row the user has kept to the routine. A planned rest day keeps
 * the run going; today not being finished yet does not break it.
 */
export function routineStreak(s: AppState): number {
  const routine = routineFor(s)
  let streak = 0
  let date = todayKey()
  if (dayProgress(s, date, routine).status !== 'done') date = addDays(date, -1)
  // rest days only count once a finished training day anchors the run
  let pendingRest = 0
  for (let i = 0; i < 400; i++, date = addDays(date, -1)) {
    const status = dayProgress(s, date, routine).status
    if (status === 'done') { streak += 1 + pendingRest; pendingRest = 0 } else if (status === 'rest') pendingRest++
    else break
  }
  return streak
}
