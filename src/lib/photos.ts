/**
 * Real photographs of the meals and their ingredients.
 *
 * Every photo is an openly licensed picture from Wikimedia Commons, chosen by
 * hand and listed in data/photos.json: a meal under its recipe id and an
 * ingredient under its CoFID food id. scripts/fetch-photos.py saves them into
 * the app (assets/photos), and components/Photo.tsx shows them. The author and
 * licence of each one are listed on the licences screen, as the licences ask.
 */
import PHOTOS from '../data/photos.json'

export interface PhotoCredit {
  /** where the picture came from */
  url: string
  /** what the picture is called on Wikimedia Commons */
  title: string
  by: string
  licence: string
  /** the picture's own page, with the full licence and author */
  page: string
}

const ALL = PHOTOS as Record<string, PhotoCredit>

export const hasPhoto = (key: string) => key in ALL

/** Every photo used, once each, in alphabetical order: for the licences screen. */
export function photoCredits(): PhotoCredit[] {
  const seen = new Map<string, PhotoCredit>()
  for (const p of Object.values(ALL)) seen.set(p.page, p)
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title))
}
