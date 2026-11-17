/**
 * What the user has achieved lately, in plain lines, worked out from the
 * app's own records (workouts logged, food logged, weigh-ins). A new chat
 * starts every day, so this is how Breeze still knows what happened before:
 * the lines go to the coach with every message, and yesterday's is shown in
 * the greeting of a new chat.
 */
import { EXERCISES } from '../data/exercises'
import { addDays, prettyDate, todayKey } from './date'
import { dayMacros } from './progress'
import { dayProgress, routineStreak } from './routine'
import type { AppState } from './types'

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`

/** What was done on one day, or nothing if nothing was. */
export function dayAchievement(s: AppState, date: string): string | undefined {
  const parts: string[] = []
  const workout = dayProgress(s, date)
  if (workout.status === 'done') parts.push(`finished ${workout.day.title}`)
  else if (workout.doneItems > 0) parts.push(`did ${workout.doneItems} of ${workout.items.length} exercises of ${workout.day.title}`)
  const eaten = dayMacros(s, date)
  if (eaten.kcal > 0) {
    const protein = s.targets.protein > 0 && eaten.protein >= s.targets.protein * 0.9
    parts.push(`logged ${Math.round(eaten.kcal)} kcal${protein ? ' and hit the protein target' : ''}`)
  }
  return parts.length ? parts.join('; ') : undefined
}

/** The heaviest set of each exercise, when it was lifted in the last two weeks and beat an earlier best. */
function newBests(s: AppState, today: string): string[] {
  const since = addDays(today, -14)
  const out: string[] = []
  for (const e of EXERCISES) {
    const sets = s.sets.filter((x) => x.exerciseId === e.id && !x.demo && x.weight > 0)
    const recent = sets.filter((x) => x.date >= since)
    const before = sets.filter((x) => x.date < since)
    if (!recent.length || !before.length) continue
    const best = recent.reduce((a, b) => (b.weight > a.weight ? b : a))
    if (best.weight > Math.max(...before.map((x) => x.weight))) out.push(`New best on ${e.name}: ${kg(best.weight)} for ${best.reps} on ${prettyDate(best.date)}`)
  }
  return out.slice(0, 3)
}

/**
 * Up to ten lines, most recent first: each of the last seven days on which
 * something was done, the current streak, new best lifts, and the change in
 * body weight since the first weigh-in.
 */
export function achievements(s: AppState, today = todayKey()): string[] {
  const out: string[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, -i)
    const line = dayAchievement(s, date)
    if (line) out.push(`${i === 0 ? 'Today' : i === 1 ? 'Yesterday' : prettyDate(date)}: ${line}`)
  }
  const streak = routineStreak(s)
  if (streak > 1) out.push(`Has kept to the routine ${streak} days in a row`)
  out.push(...newBests(s, today))
  const weighIns = s.weights.filter((w) => !w.demo).sort((a, b) => a.date.localeCompare(b.date))
  if (weighIns.length > 1) {
    const [first, last] = [weighIns[0], weighIns[weighIns.length - 1]]
    if (Math.abs(last.kg - first.kg) >= 0.5) out.push(`Body weight ${kg(first.kg)} to ${kg(last.kg)} since ${prettyDate(first.date)}`)
  }
  return out.slice(0, 10).map((l) => l.slice(0, 160))
}

/** One line for the greeting of a new day's chat: what the user did yesterday. */
export function yesterdayLine(s: AppState, today = todayKey()): string | undefined {
  const line = dayAchievement(s, addDays(today, -1))
  return line ? `Yesterday you ${line.replace(/; /g, ' and ')}.` : undefined
}
