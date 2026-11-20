/**
 * What Breeze remembers about the user between conversations: short facts in
 * the coach's own words (how they train, what they eat, what hurt last week,
 * what got in the way). The coach adds to it as the user talks, it is sent
 * with every coach message, and the user can read and delete any of it in
 * Settings. It lives on the phone and never includes the user's name.
 */
import { uid } from './date'
import type { AppState, MemoryItem } from './types'

/** Enough to know someone well, small enough to send with every message */
export const MAX_MEMORIES = 30
export const MAX_MEMORY_CHARS = 160

export const memoryOf = (s: AppState): MemoryItem[] => s.memory ?? []

const clean = (t: unknown) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_CHARS) : '')
/** Two notes are the same when they say the same words, whatever the punctuation or capitals. */
const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Add new facts, newest first. A fact already remembered is not added twice,
 * and when there are too many the oldest are let go.
 */
export function addMemories(existing: MemoryItem[], texts: unknown[], now = new Date()): MemoryItem[] {
  const seen = new Set(existing.map((m) => key(m.text)))
  const fresh: MemoryItem[] = []
  for (const raw of texts) {
    const text = clean(raw)
    const k = key(text)
    if (k.length < 3 || seen.has(k)) continue
    seen.add(k)
    fresh.push({ id: uid(), at: now.toISOString(), text })
  }
  return [...fresh.reverse(), ...existing].slice(0, MAX_MEMORIES)
}

export const forgetMemories = (existing: MemoryItem[], ids: unknown[]) => existing.filter((m) => !ids.includes(m.id))

/** The onboarding conversation's notes, one fact per sentence. */
export function notesToMemories(notes: string | undefined): string[] {
  return (notes ?? '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 2)
}

/** What the coach is sent: the fact, the day it was noted, and an id it can use to forget it. */
export const memoryForCoach = (s: AppState) => memoryOf(s).map((m) => ({ id: m.id, noted: m.at.slice(0, 10), text: m.text }))

/** What a note is about, which is how the notes are set out for the person to read. */
export type MemoryGroup = 'food' | 'training' | 'body' | 'life'
export const MEMORY_GROUPS: { id: MemoryGroup; title: string; empty: string }[] = [
  { id: 'food', title: 'Food and drink', empty: 'What you like, what you avoid and how you cook.' },
  { id: 'training', title: 'Training', empty: 'What suits you, what you dislike and where you train.' },
  { id: 'body', title: 'Your body', empty: 'Aches, injuries and how sessions have felt.' },
  { id: 'life', title: 'Your life and goals', empty: 'Your week, what gets in the way and what you are aiming at.' },
]
const ABOUT: [MemoryGroup, RegExp][] = [
  ['body', /\b(pain|painful|ache|aches|aching|sore|soreness|injur\w*|hurt\w*|twinge|strain\w*|sprain\w*|surgery|operation|physio\w*|posture|stiff\w*|tight\w*|shoulder|knee|knees|hip|hips|wrist|ankle|elbow|lower back|neck|asthma|diabet\w*|pregnan\w*|medication)\b/i],
  ['food', /\b(eat|eats|eating|ate|food|foods|meal|meals|breakfast|lunch|dinner|snack\w*|cook\w*|recipe\w*|vegetarian|vegan|halal|kosher|allerg\w*|intoleran\w*|dairy|gluten|lactose|protein shake|coffee|tea|drink\w*|alcohol|sweet\w*|chocolate|dessert\w*|sugar|takeaway|fruit|vegetables?|meat|fish|chicken|rice|pasta|bread|spicy|calories)\b/i],
  ['training', /\b(train\w*|workout\w*|session\w*|gym|exercise\w*|lift\w*|squat\w*|deadlift\w*|bench|press|curl\w*|row\w*|pull-?ups?|push-?ups?|run\w*|cardio|sets?|reps?|weights?|dumbbell\w*|barbell\w*|kettlebell\w*|machine\w*|equipment|strength|volume|warm-?up|stretch\w*|football|swim\w*|cycl\w*|yoga|too easy|too hard|too heavy)\b/i],
]
/** Which group a note belongs to, from its words. A note about an ache in a lift is about the body. */
export const memoryGroup = (text: string): MemoryGroup => ABOUT.find(([, re]) => re.test(text))?.[0] ?? 'life'
