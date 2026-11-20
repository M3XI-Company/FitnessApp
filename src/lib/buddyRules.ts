/**
 * The rules of the buddy system that the app itself applies, kept apart from
 * the network code so they can be tested. The server (functions/buddies)
 * applies the same limits again.
 */
import { canDiscoverBuddies } from './age'
import type { GoalType, Profile, RoutineDay, SetLog } from './types'

export type BuddyLevel = 'beginner' | 'intermediate' | 'advanced'
export type BuddyTime = 'morning' | 'lunch' | 'evening' | 'weekend'

export const BUDDY_TIMES: { value: BuddyTime; label: string }[] = [
  { value: 'morning', label: 'Mornings' }, { value: 'lunch', label: 'Lunchtimes' }, { value: 'evening', label: 'Evenings' }, { value: 'weekend', label: 'Weekends' },
]
export const BUDDY_LEVELS: { value: BuddyLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Some' }, { value: 'advanced', label: 'Experienced' },
]
export const GOAL_LABEL: Record<GoalType, string> = { lose: 'Losing weight', maintain: 'Getting fitter', gain: 'Building muscle' }
export const LEVEL_LABEL: Record<BuddyLevel, string> = { beginner: 'Beginner', intermediate: 'Some experience', advanced: 'Experienced' }
export const TIME_LABEL: Record<BuddyTime, string> = { morning: 'Mornings', lunch: 'Lunchtimes', evening: 'Evenings', weekend: 'Weekends' }

/** What the person has written about themselves and who they want; kept on the phone so the form opens filled in. */
export interface BuddySetup { bio: string; lookingFor: string; times: BuddyTime[]; level: BuddyLevel; daysPerWeek: number }

/** A first guess at someone's level from how much they have logged. They can change it. */
export const levelFromSets = (sets: SetLog[]): BuddyLevel => {
  const n = sets.filter((s) => !s.demo).length
  return n > 400 ? 'advanced' : n > 60 ? 'intermediate' : 'beginner'
}

/** What stops someone joining: under 18, or no gym chosen from the search (so there is a place to measure from). */
export const joinBlocker = (p: Pick<Profile, 'age' | 'gym' | 'gymPlace'>): 'age' | 'gym' | null =>
  !canDiscoverBuddies(p.age) ? 'age' : !p.gym || !p.gymPlace ? 'gym' : null

/** The name other people see: the first name only. */
export const shownName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 30) ?? ''

export interface BuddyPerson {
  id: string; name: string; age: number; goal: GoalType; level: BuddyLevel; times: BuddyTime[]; gym: string; bio: string
  days_per_week: number; km: number | null; same_gym: boolean; why?: string
}

/** Where someone trains, relative to the person looking. Never closer than "about 1 km". */
export const whereLine = (p: Pick<BuddyPerson, 'gym' | 'km' | 'same_gym'>) =>
  p.same_gym ? `${p.gym} · your gym` : p.km === null ? p.gym : `${p.gym} · about ${p.km} km away`

export interface JointItem { exercise_id: string; sets: number; reps: string; together: string }
export interface JointPlan { title: string; when: string; why: string; items: JointItem[]; at: string }

/** The shared session as a day of the person's own routine, for when they add it to their week. */
export const jointDay = (plan: JointPlan, partner: string): RoutineDay => ({
  title: plan.title.slice(0, 40) || 'Partner session',
  focus: `With ${partner}`,
  items: plan.items.slice(0, 8).map((i) => ({ exerciseId: i.exercise_id, sets: Math.min(5, Math.max(1, Math.round(i.sets))), reps: i.reps })),
})

/** "2 min ago", "3 h ago", "4 Nov": when a message was sent, short. */
export function agoLine(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
