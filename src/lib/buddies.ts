/**
 * Client for the buddy system (supabase/functions/buddies): the person's
 * partner profile, the people near them, yes and no, matches, messages and
 * the session two matched people do together.
 */
import { EXERCISES } from '../data/exercises'
import type { BuddyPerson, BuddySetup, JointPlan } from './buddyRules'
import { shownName } from './buddyRules'
import { deviceId } from './foodPhoto'
import { supabase } from './supabase'
import type { Profile } from './types'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const buddiesConfigured = () => !!(URL_BASE && ANON)

export type BuddyError = 'not_configured' | 'offline' | 'no_profile' | 'not_found' | 'slow_down' | 'monthly_limit' | 'busy' | 'failed'
type Result<T> = { ok: true; data: T } | { ok: false; error: BuddyError }

export interface BuddyMatch { id: string; since: string; person: BuddyPerson; last: { text: string; mine: boolean; at: string } | null; unread: number; has_plan: boolean }
export interface BuddyMessage { id: number; mine: boolean; text: string; at: string }
export const REPORT_REASONS = ['Romantic or sexual contact', 'Harassment or threats', 'Fake profile', 'Seems under 18', 'Unsafe behaviour', 'Other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

async function call<T>(action: string, extra: Record<string, unknown> = {}, timeoutMs = 20000): Promise<Result<T>> {
  if (!URL_BASE || !ANON) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token ?? ANON
    const res = await fetch(`${URL_BASE}/functions/v1/buddies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device: await deviceId(), action, ...extra }),
      signal: ctrl.signal,
    })
    if (res.ok) return { ok: true, data: (await res.json()) as T }
    const error: BuddyError = res.status === 409 ? 'no_profile' : res.status === 404 ? 'not_found' : res.status === 503 ? 'busy'
      : res.status === 429 ? (((await res.json().catch(() => ({}))) as { error?: string }).error === 'monthly_limit' ? 'monthly_limit' : 'slow_down') : 'failed'
    return { ok: false, error }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

export const BUDDY_ERROR: Record<BuddyError, string> = {
  not_configured: 'Training partners are not switched on in this build.',
  offline: 'Could not reach Breeze. Check your connection and try again.',
  no_profile: 'Set up your partner profile first.',
  not_found: 'That person is no longer available.',
  slow_down: 'That is a lot of messages at once. Give it a minute.',
  monthly_limit: 'You have used this month’s shared sessions. More next month.',
  busy: 'Breeze is busy right now. Try again in a moment.',
  failed: 'Something went wrong. Try again.',
}

export interface MyBuddyProfile extends BuddyPerson { looking_for: string; active: boolean }

export const getMyProfile = () => call<{ profile: MyBuddyProfile | null }>('profile_get')
export const saveMyProfile = (p: Profile, setup: BuddySetup) => call<{ ok: true }>('profile_save', {
  profile: {
    name: shownName(p.name), age: p.age, goal: p.goal, level: setup.level, times: setup.times, gym: (p.gym ?? '').slice(0, 80),
    lat: p.gymPlace?.lat ?? 0, lon: p.gymPlace?.lon ?? 0, bio: setup.bio.slice(0, 280), looking_for: setup.lookingFor.slice(0, 280), days_per_week: setup.daysPerWeek,
  },
})
export const pauseMyProfile = (paused: boolean) => call<{ ok: true }>('profile_pause', { paused })
export const deleteMyProfile = () => call<{ ok: true }>('profile_delete')
/** The nearest people who fit, best first. Takes a few seconds when Breeze orders them by the description. */
export const findPeople = () => call<{ people: BuddyPerson[]; by_description: boolean; within_km: number }>('find', {}, 30000)
export const swipe = (id: string, liked: boolean) => call<{ matched: boolean; match?: string; name?: string }>('swipe', { id, liked })
export const getMatches = () => call<{ matches: BuddyMatch[] }>('matches')
export const getMessages = (match: string, after = 0) => call<{ person: BuddyPerson | null; plan: JointPlan | null; messages: BuddyMessage[] }>('messages', { match, after })
export const sendMessage = (match: string, text: string) => call<{ message: BuddyMessage }>('send', { match, text })
/** Ask the coach for a session the two of them do together. */
export const makeJointPlan = (match: string) => call<{ plan: JointPlan }>('plan', { match, exercises: EXERCISES.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, equipment: e.equipment, level: e.level })) }, 60000)
export const unmatch = (match: string) => call<{ ok: true }>('unmatch', { match })
export const blockPerson = (id: string) => call<{ ok: true }>('block', { id })
export const reportPerson = (id: string, reason: ReportReason) => call<{ ok: true }>('report', { id, reason })
