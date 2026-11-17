import type { AppState, TrainingStyle } from './types'
import { lastNDays, todayKey, addDays } from './date'
import { dayTotals, e1rm } from './nutrition'
import { exerciseById } from '../data/exercises'

export const dayMacros = (s: AppState, date: string) => dayTotals(s.food, date).total

export const workoutDates = (s: AppState) => [...new Set(s.sets.map((x) => x.date))].sort()

/** Days in a row with a workout. Today not being done yet does not break the run. */
export const workoutStreak = (s: AppState) => {
  const done = new Set(workoutDates(s))
  let day = todayKey()
  if (!done.has(day)) day = addDays(day, -1)
  let streak = 0
  for (; done.has(day); day = addDays(day, -1)) streak++
  return streak
}

export const workoutsThisWeek = (s: AppState) => {
  const days = new Set(lastNDays(7))
  return workoutDates(s).filter((d) => days.has(d)).length
}

/** consecutive days (ending today or yesterday) with any food logged */
export const logStreak = (s: AppState) => {
  const logged = new Set(s.food.map((f) => f.date))
  let streak = 0
  const days = lastNDays(365).reverse()
  let i = logged.has(days[0]) ? 0 : 1
  for (; i < days.length && logged.has(days[i]); i++) streak++
  return streak
}

export const proteinDays = (s: AppState, n = 7) =>
  lastNDays(n).filter((d) => dayMacros(s, d).protein >= s.targets.protein * 0.9).length

export const waterDaysStreak = (s: AppState) => {
  let streak = 0
  for (const d of lastNDays(60).reverse()) {
    if ((s.water[d] ?? 0) >= s.targets.waterMl) streak++
    else if (d !== todayKey()) break
  }
  return streak
}

/** Best estimated 1RM per session date for an exercise */
export const exerciseHistory = (s: AppState, exerciseId: string) => {
  const byDate = new Map<string, number>()
  for (const set of s.sets.filter((x) => x.exerciseId === exerciseId)) {
    const v = e1rm(set.weight, set.reps)
    byDate.set(set.date, Math.max(byDate.get(set.date) ?? 0, v))
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

/**
 * Conservative first-session load as a fraction of body weight (total load;
 * per hand for dumbbells and kettlebells). The user never types a weight:
 * it starts here, from the body weight given in onboarding, and then moves
 * only by the progression rules in nextTarget.
 */
const START: Record<string, number> = {
  bench: 0.45, 'incline-db': 0.14, 'cable-fly': 0.1, deadlift: 0.6, row: 0.4, 'lat-pulldown': 0.4, 'seated-row': 0.4, 'db-row': 0.18,
  squat: 0.5, 'front-squat': 0.4, 'leg-press': 0.8, lunge: 0.1, 'leg-curl': 0.25, 'leg-ext': 0.3, calf: 0.4, rdl: 0.45, 'hip-thrust': 0.5,
  ohp: 0.28, 'db-shoulder': 0.1, lateral: 0.04, 'face-pull': 0.15, curl: 0.2, hammer: 0.08, pushdown: 0.2, skull: 0.15,
  'cable-crunch': 0.25, 'kb-swing': 0.15, goblet: 0.15,
}
const START_BY_EQUIPMENT: Record<string, number> = { Barbell: 0.35, Dumbbell: 0.1, Machine: 0.35, Cable: 0.2, Kettlebell: 0.15 }

/** Advised starting weight (kg) for someone who has never logged this exercise; 0 for bodyweight moves */
export const startingWeight = (s: AppState, exerciseId: string) => {
  const ex = exerciseById(exerciseId)
  if (!ex || ex.step === 0) return 0
  const p = s.profile
  const fraction = START[ex.id] ?? START_BY_EQUIPMENT[ex.equipment] ?? 0.2
  const scale = (p.sex === 'female' ? 0.65 : 1) * (p.age >= 55 ? 0.85 : 1)
  const raw = (p.weightKg || 70) * fraction * scale
  // an empty Olympic bar is the least a barbell lift can weigh
  const floor = ex.equipment === 'Barbell' ? 20 : ex.step
  return Math.max(floor, Math.round(raw / ex.step) * ex.step)
}

/** For this many sessions the weights are kept light on purpose, while the coach learns how the user's body takes to training. */
export const EASE_IN_SESSIONS = 3
export const sessionsDone = (s: AppState) => workoutDates(s).length
/** True while the user is still in their first few sessions. */
export const easingIn = (s: AppState) => sessionsDone(s) < EASE_IN_SESSIONS

const range = (ex: { reps: [number, number] }, label?: string): [number, number] => {
  const m = /^(\d{1,3})(?:\s?[–-]\s?(\d{1,3}))?/.exec(label ?? '')
  return m ? [+m[1], +(m[2] ?? m[1])] : ex.reps
}

/**
 * What to lift next time: the weight and reps for a set, and why.
 *
 * `plan` is the day's rep range and kind of day from the routine. On a
 * strength day the range is low and the weight high; on a volume day the
 * weight is one the user is comfortable with and the reps go up. Within a
 * range the rule is double progression: add reps until every set reaches the
 * top of the range, then add weight and start again at the bottom. When the
 * range has changed since last time (a lift moved from a volume day to a
 * strength day, say) the weight is worked out afresh from what was lifted.
 * For the first few sessions everything starts lighter still.
 */
export const nextTarget = (s: AppState, exerciseId: string, plan: { reps?: string; style?: TrainingStyle } = {}) => {
  const ex = exerciseById(exerciseId)
  if (!ex) return null
  const [lo, hi] = range(ex, plan.reps)
  const toStep = (kg: number) => Math.max(ex.equipment === 'Barbell' ? 20 : ex.step, Math.round(kg / ex.step) * ex.step)
  const sets = s.sets.filter((x) => x.exerciseId === exerciseId)
  if (!sets.length) {
    const start = startingWeight(s, exerciseId)
    if (!start) return { weight: 0, reps: lo, note: 'First session: bodyweight only. Stop 2 to 3 reps before you could do no more.' }
    const easing = easingIn(s)
    const weight = toStep(start * (plan.style === 'volume' ? 0.8 : 1) * (easing ? 0.8 : 1))
    return {
      weight, reps: lo,
      note: easing
        ? 'Starting light on purpose for your first few sessions. It should feel easy: tell me afterwards where you felt it and I will set the next one.'
        : 'First time on this one: a light starting weight set from your body weight. It should feel like you could do 3 more reps.',
    }
  }
  const lastDate = sets.map((x) => x.date).sort().at(-1)!
  const last = sets.filter((x) => x.date === lastDate)
  const top = Math.max(...last.map((x) => x.weight))
  const topSets = last.filter((x) => x.weight === top)
  const allHitTop = topSets.every((x) => x.reps >= hi)
  const minReps = Math.min(...topSets.map((x) => x.reps))
  if (ex.step === 0) {
    return { weight: top, reps: Math.min(minReps + 1, hi + 5), note: 'Bodyweight: add one rep per set, then slow the tempo.' }
  }
  // the range has moved a long way since last time: work the weight out again from what was lifted, a little under
  if (minReps > hi + 2 || minReps < lo - 2) {
    const weight = toStep((e1rm(top, minReps) / (1 + lo / 30)) * 0.92)
    return {
      weight, reps: lo,
      note: minReps > hi + 2
        ? `Heavier today: ${weight} kg for ${lo} to ${hi} reps, worked out from your last session. Stop when your form slips.`
        : `Lighter today: ${weight} kg for ${lo} to ${hi} reps. A comfortable weight, and as many clean reps as you can.`,
    }
  }
  if (allHitTop) return { weight: top + ex.step, reps: lo, note: `You hit ${hi} reps on every set — add ${ex.step} kg.` }
  return { weight: top, reps: Math.min(minReps + 1, hi), note: `Stay at ${top} kg and beat ${minReps} reps.` }
}

/** XP & levels: every logged meal, set, water glass and workout earns XP */
export const xp = (s: AppState) => {
  const foodXp = s.food.length * 5
  const setXp = s.sets.length * 3
  const workoutXp = workoutDates(s).length * 25
  const waterXp = Object.values(s.water).reduce((a, ml) => a + Math.floor(ml / 250), 0) * 2
  const total = foodXp + setXp + workoutXp + waterXp
  const level = Math.floor(Math.sqrt(total / 50)) + 1
  const curBase = 50 * (level - 1) ** 2
  const nextBase = 50 * level ** 2
  return { total, level, into: total - curBase, span: nextBase - curBase }
}

export const LEVEL_NAMES = ['Whisper', 'Breath', 'Breeze', 'Zephyr', 'Gust', 'Gale', 'Tempest', 'Hurricane']
export const levelName = (lvl: number) => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((lvl - 1) / 2))]

export const goalProgress = (s: AppState, metric: string, target: number) => {
  switch (metric) {
    case 'workouts_week': return { value: workoutsThisWeek(s), pct: workoutsThisWeek(s) / target }
    case 'protein_days': return { value: proteinDays(s), pct: proteinDays(s) / target }
    case 'water_days': return { value: waterDaysStreak(s), pct: waterDaysStreak(s) / target }
    case 'log_streak': return { value: logStreak(s), pct: logStreak(s) / target }
    case 'weight': {
      const start = s.weights[0]?.kg ?? s.profile.weightKg
      const now = s.profile.weightKg
      const pct = start === target ? 1 : (start - now) / (start - target)
      return { value: now, pct: Math.max(0, pct) }
    }
    default: return { value: 0, pct: 0 }
  }
}
