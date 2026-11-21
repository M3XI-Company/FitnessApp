/**
 * Client for the onboarding interview (supabase/functions/interview): a spoken
 * conversation in which Breeze asks one question at a time and builds up the
 * user's profile and a coach's notes about them.
 *
 * What the user says is sent as text and is not stored. Whatever comes back
 * is checked here against the app's own limits before it is used, and the
 * user confirms it on screen before anything is saved.
 */
import { isAdvisor, type Advisor } from './advisors'
import { MIN_AGE } from './age'
import { deviceId } from './foodPhoto'
import { postForOutcome } from './stream'
import type { Activity, GoalType, Profile, Sex } from './types'

export type InterviewError = 'not_configured' | 'monthly_limit' | 'declined' | 'offline' | 'busy' | 'failed'
export interface InterviewTurn { role: 'user' | 'coach'; text: string }

/** The profile as the interviewer understands it so far; "", 0 and "unknown" mean not known yet. */
export interface HeardProfile {
  name: string; age: number; sex: Sex | 'unknown'; height_cm: number; weight_kg: number; target_weight_kg: number
  goal: GoalType | 'unknown'; activity: Activity | 'unknown'
}
export interface InterviewReply { speaker?: Advisor; say: string; done: boolean; profile: HeardProfile; notes: string }

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const interviewConfigured = () => !!(URL_BASE && ANON)

const MAX_TURNS = 40
const MAX_CHARS = 1200

/** What the app already holds about a returning user, so the conversation picks up from there instead of starting again. */
export interface Known { profile: Omit<HeardProfile, 'name'>; memory: string[] }
export const knownFrom = (p: Profile, memory: string[]): Known => ({
  profile: { age: p.age, sex: p.sex, height_cm: p.heightCm, weight_kg: p.weightKg, target_weight_kg: p.targetWeightKg, goal: p.goal, activity: p.activity },
  memory: memory.slice(0, 30),
})

/**
 * Ask for the next thing to say. `turns` is the conversation so far; empty to
 * get the opening line. `known` is passed for a user who has already set up.
 */
export async function askInterview(turns: InterviewTurn[], known?: Known, on?: { thinking?: (thinking: string) => void; say?: (say: string, speaker?: Advisor) => void }): Promise<{ ok: true; reply: InterviewReply } | { ok: false; error: InterviewError }> {
  if (!interviewConfigured()) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 45000)
  try {
    const { status, body } = await postForOutcome(`${URL_BASE}/functions/v1/interview`,
      { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      { device: await deviceId(), messages: turns.slice(-MAX_TURNS).map((t) => ({ role: t.role, text: t.text.slice(0, MAX_CHARS) })).filter((t) => t.text), ...(known ? { known } : {}) },
      (event, data) => {
        if (event === 'thinking' && typeof data.text === 'string') on?.thinking?.(data.text)
        // the words to speak arrive before the rest of the answer, so talking can start sooner
        else if (event === 'say' && typeof data.say === 'string') on?.say?.(data.say, isAdvisor(data.speaker) ? data.speaker : undefined)
      },
      ctrl.signal)
    if (status === 200 && typeof body.say === 'string' && body.profile) return { ok: true, reply: { ...(body as unknown as InterviewReply), speaker: isAdvisor(body.speaker) ? body.speaker : undefined } }
    if (status === 429) return { ok: false, error: 'monthly_limit' }
    if (status === 422) return { ok: false, error: 'declined' }
    if (status === 503) return { ok: false, error: 'busy' }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

export const LIMITS = { age: [10, 100], heightCm: [120, 230], weightKg: [35, 250] } as const
const within = (v: unknown, [lo, hi]: readonly [number, number]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const SEXES: Sex[] = ['male', 'female']
const GOALS: GoalType[] = ['lose', 'maintain', 'gain']
const ACTIVITIES: Activity[] = ['sedentary', 'light', 'moderate', 'active', 'athlete']
const half = (kg: number) => Math.round(kg * 2) / 2

export type ProfileField = 'name' | 'age' | 'sex' | 'height' | 'weight' | 'goal' | 'activity'
export const PROFILE_FIELDS: ProfileField[] = ['name', 'age', 'sex', 'height', 'weight', 'goal', 'activity']

export interface Understood {
  /** `base` with every believable value from the interview applied */
  profile: Profile
  /** fields the interview did not give a usable value for; these keep the value from `base` */
  missing: ProfileField[]
  /** the user gave an age below the minimum for the app */
  underAge: boolean
}

/**
 * Turn what the interviewer heard into a profile the app can use. A value is
 * only taken when it is believable (an age of 3 or a weight of 800 kg is a
 * mis-hearing, not a fact); anything else is reported as missing so the user
 * is asked to fill it in. The target weight always agrees with the goal.
 */
export function understand(base: Profile, heard: Partial<HeardProfile> | undefined, notes?: string): Understood {
  const h = heard ?? {}
  const missing: ProfileField[] = []
  const p: Profile = { ...base }

  const name = typeof h.name === 'string' ? h.name.replace(/[^\p{L}\p{M}' -]/gu, '').trim().slice(0, 30) : ''
  if (name) p.name = name; else missing.push('name')

  const underAge = within(h.age, LIMITS.age) && (h.age as number) < MIN_AGE
  if (within(h.age, LIMITS.age) && !underAge) p.age = Math.round(h.age as number); else missing.push('age')

  if (SEXES.includes(h.sex as Sex)) p.sex = h.sex as Sex; else missing.push('sex')
  if (within(h.height_cm, LIMITS.heightCm)) p.heightCm = Math.round(h.height_cm as number); else missing.push('height')
  if (within(h.weight_kg, LIMITS.weightKg)) p.weightKg = half(h.weight_kg as number); else missing.push('weight')
  if (GOALS.includes(h.goal as GoalType)) p.goal = h.goal as GoalType; else missing.push('goal')
  if (ACTIVITIES.includes(h.activity as Activity)) p.activity = h.activity as Activity; else missing.push('activity')

  // a stated target is kept only when it points the same way as the goal
  const stated = within(h.target_weight_kg, LIMITS.weightKg) ? half(h.target_weight_kg as number) : null
  p.targetWeightKg = p.goal === 'lose' ? (stated !== null && stated < p.weightKg ? stated : Math.max(LIMITS.weightKg[0], p.weightKg - 5))
    : p.goal === 'gain' ? (stated !== null && stated > p.weightKg ? stated : p.weightKg + 4)
      : p.weightKg

  const kept = (notes ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200)
  // the coach is never given the user's name, so it is taken out of the notes too
  const nameless = name ? kept.split(new RegExp('(?<![A-Za-z])' + name.split(' ')[0] + '(?![A-Za-z])', 'gi')).join('They') : kept
  if (nameless) p.notes = nameless
  return { profile: p, missing, underAge }
}

/** How much of the profile is known, 0 to 1, for the progress shown while talking. */
export const heardProgress = (heard: Partial<HeardProfile> | undefined) => 1 - understand({ name: '', sex: 'male', age: 0, heightCm: 0, weightKg: 0, targetWeightKg: 0, activity: 'moderate', goal: 'maintain', onboarded: false }, heard).missing.length / PROFILE_FIELDS.length

const GOAL_TAG: Record<GoalType, string> = { lose: 'Lose weight', maintain: 'Stay the same', gain: 'Build muscle' }
const ACTIVITY_TAG: Record<Activity, string> = { sedentary: 'Mostly sitting', light: 'Lightly active', moderate: 'Moderately active', active: 'Very active', athlete: 'Athlete' }

/** What has been understood so far, as short tags to show while the conversation goes on. */
export function heardTags(heard: Partial<HeardProfile> | undefined): string[] {
  const blank: Profile = { name: '', sex: 'male', age: 0, heightCm: 0, weightKg: 0, targetWeightKg: 0, activity: 'moderate', goal: 'maintain', onboarded: false }
  const { profile: p, missing } = understand(blank, heard)
  const has = (f: ProfileField) => !missing.includes(f)
  return [
    has('name') ? p.name : '', has('age') ? `${p.age} years` : '', has('height') ? `${p.heightCm} cm` : '', has('weight') ? `${p.weightKg} kg` : '',
    has('goal') ? GOAL_TAG[p.goal] : '', has('activity') ? ACTIVITY_TAG[p.activity] : '',
  ].filter(Boolean)
}
