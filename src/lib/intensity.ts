/**
 * How hard the plan pushes. Steady and push are on both plans; all out is
 * part of Breeze Plus. The level is sent to the coach with every message.
 */
import { isPlus } from './plan'
import type { AppState } from './types'

export type Intensity = 'steady' | 'push' | 'all_out'

export const INTENSITIES: { id: Intensity; name: string; note: string; plus: boolean }[] = [
  { id: 'steady', name: 'Steady', note: 'Comfortable progress you can keep up.', plus: false },
  { id: 'push', name: 'Push', note: 'Asks for a little more each session.', plus: false },
  { id: 'all_out', name: 'All out', note: 'The hardest the coach will drive you, still within safe limits.', plus: true },
]

/** The level in use: the one chosen, stepped down to push when all out was chosen and Plus has ended. */
export function intensityOf(s: Pick<AppState, 'intensity' | 'subscription'>): Intensity {
  const chosen = s.intensity ?? 'steady'
  return chosen === 'all_out' && !isPlus(s) ? 'push' : chosen
}

/** What the level changes, in a sentence, for the person choosing it. */
export const intensityNote = (level: Intensity) => ({
  steady: 'Steady keeps the routine as it is and moves the weights up at the app’s normal rate.',
  push: 'Push adds a set to the first two exercises of each session when Breeze next builds your routine, and gives you something to beat each time.',
  all_out: 'All out is the fullest safe plan: more sets, up to five training days, and Breeze follows up on every missed session.',
}[level])
