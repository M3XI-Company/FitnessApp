/**
 * Times of day for meals and the workout: reading, writing and checking
 * "HH:MM", the defaults, and the user's chosen times. Kept apart from the
 * reminder scheduling so the day's schedule can use it without a cycle.
 */
import type { AppState, ReminderSettings, ReminderTimes } from './types'

export const REMINDER_SLOTS = ['breakfast', 'lunch', 'dinner', 'workout'] as const
export type ReminderSlot = (typeof REMINDER_SLOTS)[number]
export const SLOT_LABEL: Record<ReminderSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', workout: 'Workout' }

export const DEFAULT_TIMES: ReminderTimes = { breakfast: '08:00', lunch: '12:30', dinner: '18:30', workout: '17:00' }
export const DEFAULT_REMINDERS: ReminderSettings = { on: false, repeat: true, times: DEFAULT_TIMES }

const pad = (n: number) => String(n).padStart(2, '0')
/** Minutes after midnight for "HH:MM", or null when it is not a time. */
export function parseTime(t: unknown): number | null {
  if (typeof t !== 'string') return null
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t.trim())
  return m ? +m[1] * 60 + +m[2] : null
}
export const formatTime = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`
/** Move a time earlier or later, staying inside the day. */
export const shiftTime = (t: string, by: number) => formatTime(Math.max(0, Math.min(23 * 60 + 45, (parseTime(t) ?? 0) + by)))
/** "18:30" as people say it: 6:30 pm. */
export function sayTime(t: string): string {
  const m = parseTime(t) ?? 0
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}${m % 60 ? `:${pad(m % 60)}` : ''} ${h < 12 ? 'am' : 'pm'}`
}

/**
 * Times from anywhere (the coach, saved settings) made safe to use: anything
 * that is not a time falls back to the current value, and meals are kept in
 * order with at least two hours between them.
 */
export function sanitiseTimes(input: Partial<Record<ReminderSlot, unknown>> | undefined, fallback: ReminderTimes = DEFAULT_TIMES): ReminderTimes {
  const at = (slot: ReminderSlot) => parseTime(input?.[slot]) ?? parseTime(fallback[slot]) ?? parseTime(DEFAULT_TIMES[slot])!
  const breakfast = Math.min(at('breakfast'), 19 * 60)
  const lunch = Math.max(at('lunch'), breakfast + 120)
  const dinner = Math.min(Math.max(at('dinner'), lunch + 120), 23 * 60 + 45)
  return { breakfast: formatTime(breakfast), lunch: formatTime(lunch), dinner: formatTime(dinner), workout: formatTime(at('workout')) }
}

export const remindersOf = (s: AppState): ReminderSettings => s.reminders ?? DEFAULT_REMINDERS
