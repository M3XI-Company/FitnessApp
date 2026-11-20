/**
 * Telling the person's voice from Breeze's own. While Breeze is speaking the
 * microphone stays open so the person can cut in, but the phone's speaker
 * also reaches the microphone, so some of what is heard is Breeze itself.
 * What is heard counts as the person talking only when it is not just words
 * Breeze is saying.
 */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean)

/** True when what was heard is made up, mostly, of words in the line being spoken. */
export function isEcho(heard: string, speaking: string): boolean {
  const h = words(heard)
  if (!h.length) return true
  const said = new Set(words(speaking))
  return h.filter((w) => said.has(w)).length / h.length >= 0.6
}

/** True when what was heard is enough to count as someone cutting in: at least two words that are not Breeze's own. */
export const isInterruption = (heard: string, speaking: string) => words(heard).length >= 2 && !isEcho(heard, speaking)
