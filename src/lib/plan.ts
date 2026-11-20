/**
 * The two plans, and what each one gets.
 *
 * Free: the coach by text, the workouts, the meals and the logging. Breeze
 * Plus: talking to Breeze out loud, a coach that pushes harder, and a promise
 * that nothing about the person leaves their phone and account.
 *
 * What a free user shares is their own choice, asked for in plain words and
 * off until they say yes (lib/plan DataChoice). A Plus user is never asked
 * and never shares, whatever they chose before.
 *
 * This file only holds the rules, so it can be tested. Buying is in
 * lib/purchases.ts; the screen is app/subscribe.tsx.
 */
import type { AppState } from './types'

export type Tier = 'free' | 'plus'

export interface Subscription {
  tier: Tier
  /** when it started, as an ISO date and time */
  since: string
  /** bought through the App Store or Google Play, or switched on in a development build to try it */
  via: 'store' | 'preview'
}

/** A free user's answer to "may Breeze use your training data?". */
export interface DataChoice {
  share: boolean
  /** when they answered, as an ISO date and time */
  at: string
}

/** The paid plan as the stores list it. The prices here are shown until the store's own prices have loaded. */
export const PLUS = {
  name: 'Breeze Plus',
  /** what the charge is called on a bank statement and in the store's list of subscriptions */
  billedAs: 'Breeze Plus (M3XI)',
  /** the entitlement a purchase unlocks, as named in the purchases service */
  entitlement: 'plus',
  monthly: '£12.99',
  yearly: '£79.99',
  /** twelve months at the monthly price against the yearly price */
  yearlySaving: '49%',
} as const

/**
 * The plan after the store has been asked whether Plus is paid for. A paid
 * subscription that has lapsed ends; one bought on another phone or before a
 * reinstall comes back. Plus switched on in a development build is left alone.
 */
export function afterStoreCheck(current: Subscription | undefined, paid: boolean, now = new Date().toISOString()): Subscription | undefined {
  if (paid) return current?.tier === 'plus' && current.via === 'store' ? current : { tier: 'plus', since: now, via: 'store' }
  return current?.via === 'store' ? undefined : current
}

export const tierOf = (s: Pick<AppState, 'subscription'>): Tier => (s.subscription?.tier === 'plus' ? 'plus' : 'free')
export const isPlus = (s: Pick<AppState, 'subscription'>) => tierOf(s) === 'plus'

/** True only for a free user who has said yes. Plus never shares. */
export const sharesData = (s: Pick<AppState, 'subscription' | 'dataChoice'>) => !isPlus(s) && s.dataChoice?.share === true
/** True when a free user has not yet been asked. */
export const needsDataChoice = (s: Pick<AppState, 'subscription' | 'dataChoice'>) => !isPlus(s) && !s.dataChoice

/** The two plans side by side, in the order they are shown. */
export const COMPARE: { title: string; free: string; plus: string }[] = [
  { title: 'Coach', free: 'By text', plus: 'By text and out loud, voice to voice' },
  { title: 'How hard it pushes', free: 'Steady progress', plus: 'Pushes you every session for faster results' },
  { title: 'Workouts, meals and logging', free: 'Included', plus: 'Included' },
  { title: 'Your data', free: 'You choose whether to share it', plus: 'Private. Never recorded, shared or sold' },
]

/** What the charge is and where it shows up, in one sentence, so nobody wonders later what they are paying for. */
export const billingLine = (store: 'ios' | 'android' | 'other') =>
  `${store === 'ios' ? 'Apple takes the payment through your App Store account' : store === 'android' ? 'Google takes the payment through your Google Play account' : 'The payment is taken through your app store account'}. It appears as “${PLUS.billedAs}”, renews until you cancel, and you can cancel any time in your ${store === 'ios' ? 'App Store' : store === 'android' ? 'Google Play' : 'store'} subscriptions.`
