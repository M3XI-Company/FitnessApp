/**
 * Links out of the app for a meal: a video of someone cooking it, and a
 * ready-to-cook kit for the days there is no time. Both open a search on the
 * other site for this dish, so they always lead somewhere useful. Breeze is
 * not paid for either link.
 */

/** Words that describe the recipe rather than the dish, which only narrow a search. */
const FILLER = new Set(['and', 'with', 'protein', 'lean', 'extra', 'roast', 'recovery', 'crunch', 'new', 'king', 'pot', 'bowl'])

const words = (title: string) => title.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean)

/** A video search for how to cook this dish. */
export const cookingVideoUrl = (title: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to make ${words(title).join(' ')}`)}`

/** The dish in two or three plain words, which is what a recipe-box search matches best. */
export function kitQuery(title: string): string {
  const w = words(title)
  const main = w.filter((x) => !FILLER.has(x))
  return (main.length ? main : w).slice(0, 3).join(' ')
}

/** Ready-to-cook meal kits like this dish, at HelloFresh UK. */
export const mealKitUrl = (title: string) => `https://www.hellofresh.co.uk/recipes/search?q=${encodeURIComponent(kitQuery(title))}`
