/**
 * The weekly routine: which exercises the user does on which day.
 *
 * Every training day works different parts of the body, and each is either a
 * strength day (heavier, fewer reps) or a volume day (a comfortable weight,
 * more reps), so the same muscles are never trained hard two days running.
 *
 * A routine is first built from the onboarding profile (buildRoutine) and can
 * be replaced by one the AI coach proposes. Either way the routine only names
 * exercises, sets and rep ranges: the weight for each set always comes from
 * the progression rules in lib/progress, never from the routine.
 */
import { exerciseById } from '../data/exercises'
import { addDays, todayKey, uid } from './date'
import type { AppState, Profile, RoutineDay, RoutineItem, TrainingStyle, Weekday, WeeklyRoutine } from './types'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABEL: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

/** Limits every routine has to stay inside, wherever it came from */
export const ROUTINE_LIMITS = { maxItemsPerDay: 8, minSets: 1, maxSets: 5, minRestDays: 1 }

export const weekdayOf = (dateKey: string): Weekday => WEEKDAYS[(new Date(`${dateKey}T12:00:00`).getDay() + 6) % 7]

const REST: RoutineDay = { title: 'Rest day', focus: 'Recovery', items: [] }

/** Day templates, one per part of the body: exercise ids in the order they are done */
const TEMPLATES: Record<string, { title: string; focus: string; ids: string[] }> = {
  // three days a week, with exercises that are easy to learn
  chestArmsEasy: { title: 'Chest & triceps', focus: 'Chest, triceps', ids: ['incline-db', 'pushup', 'cable-fly', 'pushdown'] },
  backArmsEasy: { title: 'Back & biceps', focus: 'Back, biceps', ids: ['lat-pulldown', 'seated-row', 'db-row', 'hammer'] },
  legsShouldersEasy: { title: 'Legs & shoulders', focus: 'Legs, glutes, shoulders, core', ids: ['goblet', 'leg-press', 'glute-bridge', 'db-shoulder', 'lateral', 'plank'] },
  // four and five days a week
  chestTri: { title: 'Chest & triceps', focus: 'Chest, triceps', ids: ['bench', 'incline-db', 'cable-fly', 'pushdown', 'skull'] },
  backBi: { title: 'Back & biceps', focus: 'Back, biceps', ids: ['row', 'lat-pulldown', 'seated-row', 'curl', 'hammer'] },
  legs: { title: 'Legs', focus: 'Quads, hamstrings, glutes, calves', ids: ['squat', 'rdl', 'leg-press', 'leg-curl', 'calf'] },
  shouldersCore: { title: 'Shoulders & core', focus: 'Shoulders, core', ids: ['ohp', 'lateral', 'face-pull', 'plank', 'cable-crunch'] },
  chest: { title: 'Chest', focus: 'Chest', ids: ['bench', 'incline-db', 'cable-fly', 'pushup'] },
  back: { title: 'Back', focus: 'Back', ids: ['row', 'lat-pulldown', 'seated-row', 'db-row'] },
  shoulders: { title: 'Shoulders', focus: 'Shoulders', ids: ['ohp', 'db-shoulder', 'lateral', 'face-pull'] },
  armsCore: { title: 'Arms & core', focus: 'Biceps, triceps, core', ids: ['curl', 'pushdown', 'hammer', 'skull', 'plank', 'cable-crunch'] },
}

/** Which body part falls on which day and how it is trained, by training days per week. Strength and volume days alternate. */
const SCHEDULES: Record<3 | 4 | 5, Partial<Record<Weekday, [template: string, style: TrainingStyle]>>> = {
  3: { mon: ['chestArmsEasy', 'strength'], wed: ['backArmsEasy', 'volume'], fri: ['legsShouldersEasy', 'strength'] },
  4: { mon: ['chestTri', 'strength'], tue: ['backBi', 'volume'], thu: ['legs', 'strength'], fri: ['shouldersCore', 'volume'] },
  5: { mon: ['chest', 'strength'], tue: ['back', 'volume'], wed: ['legs', 'strength'], fri: ['shoulders', 'volume'], sat: ['armsCore', 'volume'] },
}
const DAYS_PER_WEEK: Record<Profile['activity'], 3 | 4 | 5> = { sedentary: 3, light: 3, moderate: 4, active: 5, athlete: 5 }
/** a short conditioning finisher on fat-loss plans, rotated through the week */
const FINISHERS = ['mountain', 'kb-swing', 'burpee']
/** The big lifts, which are the ones done heavy on a strength day. */
const HEAVY = new Set(['bench', 'squat', 'front-squat', 'deadlift', 'row', 'ohp', 'rdl', 'hip-thrust', 'leg-press', 'lat-pulldown'])

export const STYLE_LABEL: Record<TrainingStyle, string> = { strength: 'Strength day', volume: 'Volume day' }
/** What each kind of day means, in a line. */
export const STYLE_MEANING: Record<TrainingStyle, string> = {
  strength: 'Heavier weight, fewer reps. Stop a set when your form starts to slip.',
  volume: 'A comfortable weight, and as many clean reps as you can within the range.',
}

/**
 * The rep range for an exercise on a kind of day. Holds, bodyweight moves and
 * conditioning keep their own range whatever the day.
 */
export function repsFor(exerciseId: string, style?: TrainingStyle): string {
  const ex = exerciseById(exerciseId)
  if (!ex) return '8–12'
  if (!style || ex.step === 0 || ex.muscle === 'Cardio' || ex.muscle === 'Core') return `${ex.reps[0]}–${ex.reps[1]}`
  if (style === 'volume') return '12–15'
  // heavy and few on the big lifts; smaller movements stay moderate so the joints are not loaded hard
  return HEAVY.has(ex.id) ? '4–6' : '6–10'
}

/** The starting routine for a profile: training days from activity level, emphasis from the goal. */
export function buildRoutine(profile: Profile): WeeklyRoutine {
  const schedule = SCHEDULES[DAYS_PER_WEEK[profile.activity] ?? 3]
  let trained = 0
  const days = Object.fromEntries(WEEKDAYS.map((d) => {
    const planned = schedule[d]
    if (!planned) return [d, REST]
    const [key, style] = planned
    const t = TEMPLATES[key]
    const ids = profile.goal === 'lose' ? [...t.ids, FINISHERS[trained % FINISHERS.length]] : t.ids
    trained++
    const items: RoutineItem[] = ids.map((id, i) => ({
      exerciseId: id,
      // an extra set on the heavy lifts of a strength day, and on the first two lifts when building muscle
      sets: (style === 'strength' && HEAVY.has(id)) || (profile.goal === 'gain' && i < 2) ? 4 : 3,
      reps: repsFor(id, style),
    }))
    return [d, { title: t.title, focus: t.focus, items, style }]
  })) as Record<Weekday, RoutineDay>
  return { id: uid(), createdAt: new Date().toISOString(), source: 'profile', days }
}

/**
 * Make any proposed routine safe to use: unknown exercises are dropped, sets
 * and day length are clamped, a rep label is always present, and at least one
 * rest day is kept. Returns null when nothing usable is left.
 */
export function sanitiseRoutine(input: { days: Partial<Record<Weekday, { title?: string; focus?: string; style?: string; items?: { exerciseId: string; sets: number; reps?: string }[] }>> }, source: WeeklyRoutine['source']): WeeklyRoutine | null {
  const days = Object.fromEntries(WEEKDAYS.map((d) => {
    const raw = input.days[d]
    const seen = new Set<string>()
    const style: TrainingStyle | undefined = raw?.style === 'strength' || raw?.style === 'volume' ? raw.style : undefined
    const items: RoutineItem[] = (raw?.items ?? [])
      .filter((it) => exerciseById(it.exerciseId) && !seen.has(it.exerciseId) && seen.add(it.exerciseId))
      .slice(0, ROUTINE_LIMITS.maxItemsPerDay)
      .map((it) => ({
        exerciseId: it.exerciseId,
        sets: Math.max(ROUTINE_LIMITS.minSets, Math.min(ROUTINE_LIMITS.maxSets, Math.round(it.sets) || 3)),
        reps: it.reps && /^\d{1,3}(\s?[–-]\s?\d{1,3})?(\s?s)?$/.test(it.reps.trim()) ? it.reps.trim().replace(/\s?-\s?/, '–') : repsFor(it.exerciseId, style),
      }))
    if (!items.length) return [d, REST]
    return [d, { title: (raw?.title ?? '').trim().slice(0, 40) || 'Workout', focus: (raw?.focus ?? '').trim().slice(0, 60), items, ...(style ? { style } : {}) }]
  })) as Record<Weekday, RoutineDay>
  const training = WEEKDAYS.filter((d) => days[d].items.length)
  if (!training.length) return null
  // keep the minimum rest: the last training days of the week become rest days
  for (let i = training.length - 1; WEEKDAYS.length - training.length < ROUTINE_LIMITS.minRestDays && i >= 0; i--) { days[training[i]] = REST; training.pop() }
  return { id: uid(), createdAt: new Date().toISOString(), source, days }
}

/**
 * The routine in use: the saved one, or the starting routine for this profile.
 * A starting routine saved before days had a body part and a style (known by
 * its old day names) is built again, so everyone gets the split; a routine agreed with the coach is kept.
 */
const OLD_TITLES = new Set(['Full body A', 'Full body B', 'Upper body A', 'Upper body B', 'Lower body A', 'Lower body B', 'Push', 'Pull', 'Legs'])
export function routineFor(s: AppState): WeeklyRoutine {
  const saved = s.routine
  if (!saved) return buildRoutine(s.profile)
  const training = WEEKDAYS.map((d) => saved.days[d]).filter((d) => d.items.length)
  const dated = saved.source === 'profile' && training.length > 0 && training.every((d) => !d.style && OLD_TITLES.has(d.title))
  return dated ? buildRoutine(s.profile) : saved
}

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
