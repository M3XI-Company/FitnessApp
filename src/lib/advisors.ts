/**
 * Breeze is two coaches who work as a pair. Gale looks after the training:
 * strength, technique, progression and the reasons behind them. Skye looks
 * after the life round it: food, habits, sleep, motivation and what gets in
 * the way. Every reply is written by one of them, and each has a voice of
 * their own. Kept apart from the screen so it can be tested.
 */
import { PHONE_VOICE, voiceOf } from './voices'

export type Advisor = 'performance' | 'lifestyle'

export interface AdvisorInfo { id: Advisor; name: string; role: string; about: string }

export const ADVISORS: Record<Advisor, AdvisorInfo> = {
  performance: { id: 'performance', name: 'Gale', role: 'Training', about: 'Strength, technique and how you progress' },
  lifestyle: { id: 'lifestyle', name: 'Skye', role: 'Habits and food', about: 'Meals, sleep, motivation and keeping it going' },
}

export const isAdvisor = (v: unknown): v is Advisor => v === 'performance' || v === 'lifestyle'
export const otherAdvisor = (a: Advisor): Advisor => (a === 'performance' ? 'lifestyle' : 'performance')

/**
 * The voice a coach speaks with: a man's for Gale and a woman's for Skye, in
 * the accent of the voice the person chose. Undefined means the chosen voice
 * as it is: no coach named, or the person chose the phone's own voice.
 */
export function advisorVoice(a: Advisor | undefined, chosen: string | undefined): string | undefined {
  if (!a || chosen === PHONE_VOICE) return undefined
  const american = voiceOf(chosen).accent === 'American'
  return a === 'performance' ? (american ? 'am_michael' : 'bm_george') : (american ? 'af_heart' : 'bf_emma')
}
