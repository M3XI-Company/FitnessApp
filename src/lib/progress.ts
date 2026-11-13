import type { AppState } from './types'
import { lastNDays, todayKey } from './date'
import { dayTotals, e1rm } from './nutrition'
import { exerciseById } from '../data/exercises'

export const dayMacros = (s: AppState, date: string) => dayTotals(s.food, date).total

export const workoutDates = (s: AppState) => [...new Set(s.sets.map((x) => x.date))].sort()

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

/** Double-progression recommendation for next session */
export const nextTarget = (s: AppState, exerciseId: string) => {
  const ex = exerciseById(exerciseId)
  if (!ex) return null
  const sets = s.sets.filter((x) => x.exerciseId === exerciseId)
  if (!sets.length) return { weight: 0, reps: ex.reps[0], note: 'First session — pick a weight you could lift for ~3 more reps.' }
  const lastDate = sets.map((x) => x.date).sort().at(-1)!
  const last = sets.filter((x) => x.date === lastDate)
  const top = Math.max(...last.map((x) => x.weight))
  const topSets = last.filter((x) => x.weight === top)
  const allHitTop = topSets.every((x) => x.reps >= ex.reps[1])
  const minReps = Math.min(...topSets.map((x) => x.reps))
  if (ex.step === 0) {
    return { weight: top, reps: Math.min(minReps + 1, ex.reps[1] + 5), note: 'Bodyweight: add one rep per set, then slow the tempo.' }
  }
  if (allHitTop) return { weight: top + ex.step, reps: ex.reps[0], note: `You hit ${ex.reps[1]} reps on every set — add ${ex.step} kg.` }
  return { weight: top, reps: Math.min(minReps + 1, ex.reps[1]), note: `Stay at ${top} kg and beat ${minReps} reps.` }
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
