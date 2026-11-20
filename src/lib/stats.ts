/**
 * The numbers behind the progress charts: where the person's weight has been
 * and where the plan takes it, how many sessions they did each week against
 * how many the routine asks for, and how their eating has gone against the
 * target. Kept free of anything that draws, so it can be tested.
 */
import { addDays, todayKey } from './date'
import { computeTargets, dayTotals, weeklyChangeKg } from './nutrition'
import { WEEKDAYS, routineFor, weekdayOf } from './routine'
import type { AppState, Profile } from './types'

/** Weigh-ins in date order. */
export const weightTrend = (s: Pick<AppState, 'weights'>) => [...s.weights].sort((a, b) => a.date.localeCompare(b.date))

export interface Projection {
  /** weight at the end of each week, starting with today's */
  points: number[]
  /** kg a week at the current target; negative when losing */
  perWeek: number
  /** weeks until the target weight is reached; null when there is no target to reach or it is not moving */
  weeksToTarget: number | null
  /** the day the target is reached, as a date key */
  reachedOn: string | null
}

/** Where the plan takes the person's weight, week by week, until the target or `maxWeeks`. */
export function projection(p: Profile, kcal = computeTargets(p).kcal, maxWeeks = 16, today = todayKey()): Projection {
  const perWeek = weeklyChangeKg(p, kcal)
  const gap = p.targetWeightKg - p.weightKg
  const moving = p.goal !== 'maintain' && perWeek !== 0 && Math.sign(perWeek) === Math.sign(gap)
  const weeksToTarget = moving ? Math.ceil(gap / perWeek) : null
  const weeks = Math.max(2, Math.min(maxWeeks, weeksToTarget ?? maxWeeks))
  const points = Array.from({ length: weeks + 1 }, (_, i) => {
    const kg = p.weightKg + (moving ? perWeek * i : 0)
    const capped = moving ? (perWeek < 0 ? Math.max(p.targetWeightKg, kg) : Math.min(p.targetWeightKg, kg)) : kg
    return Math.round(capped * 10) / 10
  })
  return { points, perWeek, weeksToTarget, reachedOn: weeksToTarget === null ? null : addDays(today, weeksToTarget * 7) }
}

/** How many days a week the routine trains. */
export const plannedSessions = (s: AppState) => { const r = routineFor(s); return WEEKDAYS.filter((d) => r.days[d].items.length).length }

/** The Monday of the week a date falls in. */
export const weekStart = (date: string) => addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)))

/** Sessions done in each of the last `n` weeks, oldest first; the last is this week so far. */
export function weeklySessions(s: Pick<AppState, 'sets'>, n = 8, today = todayKey()): { label: string; value: number }[] {
  const days = new Set(s.sets.map((x) => x.date))
  const thisWeek = weekStart(today)
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(thisWeek, -(n - 1 - i) * 7)
    const value = Array.from({ length: 7 }, (_, d) => addDays(start, d)).filter((d) => days.has(d)).length
    return { label: i === n - 1 ? 'Now' : `${Number(start.slice(8))}/${Number(start.slice(5, 7))}`, value }
  })
}

/** Calories and protein eaten on each of the last `n` days, oldest first. Days with nothing logged are 0. */
export function foodDays(s: Pick<AppState, 'food'>, n = 7, today = todayKey()): { date: string; label: string; kcal: number; protein: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, -(n - 1 - i))
    const t = dayTotals(s.food, date).total
    return { date, label: weekdayOf(date).slice(0, 1).toUpperCase(), kcal: Math.round(t.kcal), protein: Math.round(t.protein) }
  })
}

/** How the person's weight has moved since their first weigh-in, in kg; 0 with fewer than two. */
export const weightChange = (s: Pick<AppState, 'weights'>) => {
  const w = weightTrend(s)
  return w.length < 2 ? 0 : Math.round((w[w.length - 1].kg - w[0].kg) * 10) / 10
}

/** "0.45 kg a week" in words the person can act on. */
export const paceLine = (pr: Projection, p: Pick<Profile, 'targetWeightKg' | 'goal'>): string => {
  if (pr.weeksToTarget === null) return p.goal === 'maintain' ? 'Your calories hold your weight steady while you get fitter and stronger.' : 'Your calories are set to hold your weight for now.'
  const rate = `${Math.abs(pr.perWeek).toFixed(2).replace(/0$/, '')} kg a week`
  const when = pr.reachedOn ? new Date(`${pr.reachedOn}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''
  return `About ${rate}: ${p.targetWeightKg} kg in ${pr.weeksToTarget} week${pr.weeksToTarget === 1 ? '' : 's'}${when ? `, around ${when}` : ''}.`
}
