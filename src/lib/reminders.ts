/**
 * Reminders: when the phone should tell the user to eat and to train.
 *
 * This file only decides what to send and when (it has no notification code,
 * so it can be tested). lib/notify.ts hands the plan to the phone. The plan
 * covers the next week and is rebuilt whenever the app is opened or the
 * routine, meals or times change, so each reminder names that day's actual
 * meal and workout, and rest days and finished workouts are skipped.
 */
import { mealsFor, portionLabel, sessionMinutes } from './chat'
import { addDays, todayKey, uid } from './date'
import { dayProgress } from './routine'
import type { AppState, ChatMessage, ReminderSettings, ReminderTimes } from './types'

export const REMINDER_SLOTS = ['breakfast', 'lunch', 'dinner', 'workout'] as const
export type ReminderSlot = (typeof REMINDER_SLOTS)[number]
export const SLOT_LABEL: Record<ReminderSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', workout: 'Workout' }

export const DEFAULT_TIMES: ReminderTimes = { breakfast: '08:00', lunch: '12:30', dinner: '18:30', workout: '17:00' }
export const DEFAULT_REMINDERS: ReminderSettings = { on: false, repeat: true, times: DEFAULT_TIMES }

/** Days ahead that are scheduled; the plan is rebuilt each time the app opens. */
export const DAYS_AHEAD = 7
/** A reminder is repeated this many more times, this far apart, until the app is opened. */
export const REPEATS = 2
export const REPEAT_MINUTES = 10
/** Follow-up pings are only planned for today and tomorrow, which keeps the total well under the phone's limit. */
const REPEAT_DAYS = 2

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

/** The coach's answer to a plain ask for reminders: the current times as a card to adjust and turn on. */
export function remindersMessage(s: AppState): ChatMessage {
  const r = remindersOf(s)
  return {
    id: uid(), role: 'coach', reminders: r.times,
    text: r.on ? 'These are your reminder times. Change any of them here.' : 'I can remind you when to eat and when to train. Set the times, then turn them on.',
  }
}

export interface PlannedReminder {
  /** stable per day, slot and repeat, so the same plan always has the same ids */
  id: string
  at: Date
  slot: ReminderSlot
  title: string
  body: string
  /** 0 for the reminder itself, 1+ for the follow-up pings */
  repeat: number
}

const dateAt = (dateKey: string, minutes: number) => new Date(`${dateKey}T${formatTime(minutes)}:00`)

/**
 * Every reminder to schedule from `now` on. Nothing is planned when reminders
 * are off. A follow-up ping is only planned while its reminder is still in
 * the future, so opening the app after a reminder fires stops the pings.
 */
export function planReminders(s: AppState, now = new Date()): PlannedReminder[] {
  const r = remindersOf(s)
  if (!r.on) return []
  const times = sanitiseTimes(r.times)
  const today = todayKey(now)
  const out: PlannedReminder[] = []
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i)
    const meals = mealsFor(s, date)
    const workout = dayProgress(s, date)
    for (const slot of REMINDER_SLOTS) {
      const base = dateAt(date, parseTime(times[slot])!)
      if (base <= now) continue
      let title: string
      let body: string
      if (slot === 'workout') {
        if (workout.status === 'rest' || workout.status === 'done') continue
        title = `Time to train: ${workout.day.title}`
        body = `${workout.items.length} exercises, about ${sessionMinutes(workout.items)} minutes. Open Breeze and say you are starting.`
      } else {
        // the day's meals in order: first is breakfast, last is dinner
        const recipe = meals.recipes[slot === 'breakfast' ? 0 : slot === 'lunch' ? Math.min(1, meals.recipes.length - 1) : meals.recipes.length - 1]
        if (!recipe) continue
        // with fewer than three meals planned, do not announce the same one twice
        if (slot === 'lunch' && meals.recipes.length < 3) continue
        if (slot === 'dinner' && meals.recipes.length < 2) continue
        title = `${SLOT_LABEL[slot]}: ${recipe.recipe.title}`
        body = `${meals.portion === 1 ? '' : `${portionLabel(meals.portion)}. `}${Math.round(recipe.perServing.kcal * meals.portion)} kcal, ${Math.round(recipe.perServing.protein * meals.portion)} g protein. About ${recipe.minutes} minutes to make.`
      }
      out.push({ id: `${date}-${slot}-0`, at: base, slot, title, body, repeat: 0 })
      if (r.repeat && i < REPEAT_DAYS) {
        for (let n = 1; n <= REPEATS; n++) {
          out.push({ id: `${date}-${slot}-${n}`, at: new Date(base.getTime() + n * REPEAT_MINUTES * 60000), slot, title: `Reminder: ${title}`, body: 'Open Breeze to stop these reminders.', repeat: n })
        }
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** A short fingerprint of a plan, so the phone is only rescheduled when something changed. */
export const planKey = (plan: PlannedReminder[]) => plan.map((p) => `${p.id}@${p.at.getTime()}:${p.title}`).join('|')
