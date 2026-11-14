/**
 * Quick find: guesses what the user is looking for from what they have typed
 * so far. Every word typed must match something about the item (a prefix, a
 * part of a word, or a near miss for typos); better matches come first.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** edit distance, capped: returns `max + 1` as soon as the words are further apart than `max` */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** how well one typed word matches one word of the item: 0 = no match */
function wordScore(typed: string, word: string) {
  if (word === typed) return 10
  if (word.startsWith(typed)) return 8
  if (typed.length >= 3 && word.includes(typed)) return 5
  // typos: allow one slip in a 4+ letter word, two in 8+, against the same-length start of the word
  const slips = typed.length >= 8 ? 2 : typed.length >= 4 ? 1 : 0
  if (slips && distance(typed, word.slice(0, Math.max(typed.length, Math.min(word.length, typed.length + 1))), slips) <= slips) return 3
  return 0
}

/**
 * Rank `items` against `query`. `fields` returns the texts to search, most
 * important first (a name match beats a category match). An empty query
 * returns everything in its original order.
 */
export function quickFind<T>(query: string, items: T[], fields: (item: T) => string[]): T[] {
  const typed = norm(query).split(' ').filter(Boolean)
  if (!typed.length) return items
  const scored: { item: T; score: number; i: number }[] = []
  items.forEach((item, i) => {
    const texts = fields(item).map(norm)
    let total = 0
    for (const t of typed) {
      let best = 0
      texts.forEach((text, rank) => {
        const weight = rank === 0 ? 2 : 1
        if (rank === 0 && text.startsWith(t)) best = Math.max(best, 12 * weight)
        for (const word of text.split(' ')) best = Math.max(best, wordScore(t, word) * weight)
      })
      if (!best) return // every typed word has to match something
      total += best
    }
    scored.push({ item, score: total, i })
  })
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.item)
}
