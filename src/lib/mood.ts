/**
 * Breeze's mood: how its face (the orb) looks and moves, which follows how
 * the conversation is going. The AI coach names a mood with each reply; when
 * it has not (the built-in coach, or while a reply is on its way) the mood is
 * read from what the user last said.
 */
import type { ChatMessage } from './types'

export const MOODS = ['calm', 'upbeat', 'fired_up', 'gentle', 'proud'] as const
export type Mood = (typeof MOODS)[number]

export const isMood = (v: unknown): v is Mood => (MOODS as readonly unknown[]).includes(v)

/** What to look for in the user's own words, most telling first. */
const SIGNS: [Mood, RegExp][] = [
  ['gentle', /\b(hurts?|hurting|pain(ful)?|sore|injur(y|ed)|twinge|ache|aching|tired|exhausted|knackered|ill|sick|unwell|stressed|sad|down|low|struggl\w*|can'?t (do|face|be bothered)|gave up|giving up|failed|skipp?ed|missed|rough|awful|terrible|rubbish)\b/i],
  ['proud', /\b(did it|done it|finished|completed|smashed|nailed|crushed|new (pb|pr|best|record)|personal best|pb|hit my (target|goal)|lost \d|down \d|\d+ ?(kg|kilos?|lbs?|pounds) (down|lighter|off)|streak)\b/i],
  ['fired_up', /\b(let'?s go|start(ing)? (my )?(workout|session|training)|continue my workout|ready to (train|go|lift)|bring it|pumped|fired up|motivated|push me|harder|heavier|one more)\b/i],
  ['upbeat', /\b(thanks|thank you|great|love (it|this|that)|awesome|brilliant|perfect|nice one|feeling good|felt good|went well|enjoy(ed)?|happy|excited|cheers)\b|!/i],
]

/** The mood in something the user said, if it shows one. */
export function moodOfText(text: string): Mood | undefined {
  return SIGNS.find(([, re]) => re.test(text))?.[0]
}

/**
 * The mood of the chat right now. The latest thing said decides: a reply from
 * the coach carries its own mood, a guided workout in progress is fired up,
 * and a message from the user still waiting for its reply is read directly.
 */
export function chatMood(chat: ChatMessage[]): Mood {
  for (let i = chat.length - 1; i >= 0 && i >= chat.length - 6; i--) {
    const m = chat[i]
    if (m.role === 'user') {
      const mood = moodOfText(m.text)
      if (mood) return mood
    } else {
      if (m.mood) return m.mood
      if (m.guide) return 'fired_up'
      if (m.checkin) return 'proud'
    }
  }
  return 'calm'
}
