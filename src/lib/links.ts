/**
 * Links out of the app for a meal: a video of someone cooking it, similar
 * recipes to compare it with, and each ingredient at a supermarket that
 * sells online. All of them open a search on the other site, so they always
 * lead somewhere useful. Breeze is not paid for any of them, and the price and
 * the checkout are the shop's own.
 */

/** Words that describe the recipe rather than the dish, which only narrow a search. */
const FILLER = new Set(['and', 'with', 'protein', 'lean', 'extra', 'roast', 'recovery', 'crunch', 'new', 'king', 'pot', 'bowl'])

const words = (title: string) => title.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean)

/** A video search for how to cook this dish. */
export const cookingVideoUrl = (title: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to make ${words(title).join(' ')}`)}`

/** The dish in two or three plain words, which is what a recipe search matches best. */
export function kitQuery(title: string): string {
  const w = words(title)
  const main = w.filter((x) => !FILLER.has(x))
  return (main.length ? main : w).slice(0, 3).join(' ')
}

/** Published recipes for the same dish, to compare with ours. Our recipes are written for the app, so this is further reading, not where they came from. */
export const similarRecipesUrl = (title: string) => `https://www.bbcgoodfood.com/search?q=${encodeURIComponent(kitQuery(title))}`

/** Supermarkets that sell online, and where each one's search for an item is. */
export const SHOPS = [
  { id: 'tesco', name: 'Tesco', search: (q: string) => `https://www.tesco.com/groceries/en-GB/search?query=${q}` },
  { id: 'sainsburys', name: 'Sainsbury’s', search: (q: string) => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${q}` },
  { id: 'asda', name: 'Asda', search: (q: string) => `https://groceries.asda.com/search/${q}` },
  { id: 'ocado', name: 'Ocado', search: (q: string) => `https://www.ocado.com/search?entry=${q}` },
  { id: 'aldi', name: 'Aldi', search: (q: string) => `https://www.aldi.co.uk/results?q=${q}` },
] as const
export type ShopId = (typeof SHOPS)[number]['id']

/** One ingredient at one shop: its search there, where the price is shown and it can be added to the basket. */
export function shopUrl(shop: ShopId, item: string): string {
  const s = SHOPS.find((x) => x.id === shop) ?? SHOPS[0]
  return s.search(encodeURIComponent(item.trim().toLowerCase()))
}
