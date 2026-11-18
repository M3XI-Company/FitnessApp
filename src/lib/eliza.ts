/**
 * ELIZA: the part of Breeze that answers on the phone, with no connection and
 * no wait. It works the way Weizenbaum's 1966 program did: find the
 * highest-ranked keyword in what was said, take the sentence apart around it,
 * turn "I" and "my" into "you" and "your", and put the pieces back into a
 * reply. It does not understand anything, and it does not need to for the
 * jobs it is given.
 *
 * Its jobs are the plain ones: start the workout, show a day's plan, show the
 * reminders, say how much water or how many calories are left. Anything that
 * takes understanding (a change of plan, a question about the body, a long
 * message) it hands to the AI coach, which also reads ELIZA's turns in the
 * conversation and so can put right anything it got wrong. When the AI coach
 * cannot be reached, ELIZA keeps the conversation going in its own way.
 */
import { localAnswer, localIntent, type LocalIntent } from './chat'
import { NOTHING_MATCHED, reply } from './coach'
import { todayKey, uid } from './date'
import { remindersMessage } from './reminders'
import type { AppState, ChatMessage } from './types'

/** A job ELIZA does itself. */
export type ElizaTask = LocalIntent | 'water' | 'food'

/** The job a message asks for, when it is a short, plain ask for one. Anything longer or less plain is for the AI coach. */
export function elizaTask(text: string): ElizaTask | null {
  const plan = localIntent(text)
  if (plan) return plan
  const q = text.toLowerCase().trim()
  if (q.length > 70) return null
  if (/^(how much|how many glasses of|what(?:'s| is) my) (more )?(water|hydration)\b/.test(q) || /^(water|hydration) (left|so far|today)[?]?$/.test(q)) return 'water'
  if (/^(how many|how much|what(?:'s| is| are) my)\b.*\b(calories|kcal|protein|macros)\b.*\b(left|remaining|so far|today|to go)\b/.test(q) || /^(calories|kcal|protein|macros) (left|remaining|so far|today)[?]?$/.test(q)) return 'food'
  return null
}

/** Does the job a message asks for and answers, or returns null when the message needs understanding. */
export function elizaHandle(s: AppState, text: string, today = todayKey()): ChatMessage | null {
  const task = elizaTask(text)
  if (!task) return null
  if (task === 'reminders') return remindersMessage(s)
  if (task === 'water') return reply(s, 'water')
  if (task === 'food') return reply(s, 'calories')
  return localAnswer(s, task, today)
}

const SWAP: Record<string, string> = {
  i: 'you', me: 'you', my: 'your', mine: 'yours', myself: 'yourself', am: 'are', "i'm": 'you are', im: 'you are', "i've": 'you have', "i'll": 'you will', "i'd": 'you would',
  you: 'I', your: 'my', yours: 'mine', yourself: 'myself', "you're": 'I am',
}

/** What the user said, turned to face them: "my knee" becomes "your knee". */
export function reflect(fragment: string): string {
  return fragment.trim().replace(/[.!?]+$/, '').split(/\s+/).map((w) => SWAP[w.toLowerCase()] ?? w).join(' ')
}

interface Rule {
  /** the higher, the sooner it is chosen when several keywords are present */
  rank: number
  /** the keyword and the sentence around it; a bracketed part is handed to the reply as $1 */
  when: RegExp
  /** replies to choose from, in turn */
  say: string[]
}

/** The script: what ELIZA listens for and what it says back, written for someone training and eating to a plan. */
const SCRIPT: Rule[] = [
  { rank: 50, when: /\b(suicid\w*|kill myself|end my life|self[- ]?harm\w*|don'?t want to (?:live|be here))\b/, say: [
    'I am really glad you said that, and I am not the right help for it. Please talk to someone now: Samaritans are free on 116 123 at any hour, and if you are in danger call 999.',
  ] },
  { rank: 40, when: /\b(pain|painful|hurts?|hurting|injur\w*|dizzy|faint\w*|numb\w*|chest)\b/, say: [
    'Stop the exercise that brings it on. If it is sharp, sudden, or does not settle with rest, see your GP or a physio before you train on it again. Where exactly is it, and when does it come on?',
  ] },
  { rank: 30, when: /\bi (?:can'?t|cannot|couldn'?t) (.+)/, say: ['What makes you feel you can’t $1?', 'What is the smallest version of that you could still do?', 'What would need to change for you to $1?'] },
  { rank: 30, when: /\bwhy (?:can'?t|don'?t|am i not|do i not) i? ?(.+)/, say: ['What do you think gets in the way?', 'When did you first notice that?', 'What have you already tried?'] },
  { rank: 28, when: /\bi(?: am|'m)? feel(?:ing)? (.+)/, say: ['What do you think is making you feel $1?', 'How long have you felt $1?', 'Does feeling $1 change what you want from today?'] },
  { rank: 25, when: /\b(tired|sore|exhausted|knackered|shattered|drained|stiff|aching)\b/, say: [
    'Is that from training, from sleep, or from the day you have had?',
    'Recovery is part of training. How did you sleep, and how hard was your last session?',
    'Would a lighter session suit today, or does your body want the day off?',
  ] },
  { rank: 25, when: /\bi (?:want|need|wish|would like|'d like) (?:to )?(.+)/, say: ['What would it mean for you to $1?', 'What is one step toward that you could take this week?', 'What has stopped you so far?'] },
  { rank: 22, when: /\b(skip\w*|lazy|motivat\w*|give up|giving up|can'?t be bothered|no energy)\b/, say: [
    'What is the smallest version of today’s session you would still do?',
    'Do not aim for a perfect session, aim for a started one. What would get you through the warm-up?',
    'What made the last session you were glad you did worth it?',
  ] },
  { rank: 20, when: /\bi(?: am|'m) (.+)/, say: ['How long have you been $1?', 'How does being $1 affect your training?', 'What would you like to do about being $1?'] },
  { rank: 18, when: /\bbecause (.+)/, say: ['Is that the main reason?', 'What other reasons come to mind?', 'If that were not true, what would you do?'] },
  { rank: 15, when: /\bmy (.+)/, say: ['Tell me more about your $1.', 'Why does your $1 matter to you right now?', 'What would you like to change about your $1?'] },
  { rank: 12, when: /\b(always|never|every time)\b/, say: ['Can you think of a time it went differently?', 'When did it last happen?'] },
  { rank: 10, when: /\b(sorry|apolog\w*)\b/, say: ['No need to apologise. What is on your mind?'] },
  { rank: 10, when: /^(hi|hello|hey|hiya|morning|evening|good (?:morning|afternoon|evening))\b/, say: ['Hello. How are you feeling about training today?', 'Hello. What would you like to get done today?'] },
  { rank: 10, when: /\b(thanks|thank you|cheers|ta)\b/, say: ['Any time. What is next for you today?'] },
  { rank: 5, when: /^(yes|yeah|yep|ok|okay|sure)\b/, say: ['Good. What comes next?', 'Tell me a bit more.'] },
  { rank: 5, when: /^(no|nope|nah)\b/, say: ['What would you rather do instead?', 'Why not?'] },
]

/** What ELIZA says when nothing in the script matches. */
const NONE = ['Tell me more about that.', 'What does that look like on a normal day for you?', 'How does that affect your training or your eating?', 'What would you like to happen next?']

/**
 * ELIZA's own reply to a message: the classic keyword, take-apart and
 * put-back-together. `turn` picks among a rule's replies so the same thing
 * said twice is not answered the same way twice.
 */
export function elizaSay(text: string, turn = 0): string {
  const q = text.toLowerCase().replace(/[’`]/g, "'").trim()
  let best: { rule: Rule; match: RegExpMatchArray } | null = null
  for (const rule of SCRIPT) {
    const match = q.match(rule.when)
    if (match && (!best || rule.rank > best.rule.rank)) best = { rule, match }
  }
  if (!best) return NONE[turn % NONE.length]
  const line = best.rule.say[turn % best.rule.say.length]
  return line.replace('$1', reflect(best.match[1] ?? ''))
}

/**
 * The reply when the AI coach cannot be reached: an answer from the user's
 * own numbers where the message is about them, and ELIZA's own reply
 * otherwise. Matters of safety are always ELIZA's fixed words, never a guess.
 */
export function elizaFallback(s: AppState, text: string): ChatMessage {
  const q = text.toLowerCase()
  const serious = SCRIPT.filter((r) => r.rank >= 40).some((r) => r.when.test(q))
  if (!serious) {
    const fromData = reply(s, text)
    if (fromData.text !== NOTHING_MATCHED) return fromData
  }
  return { id: uid(), role: 'coach', text: elizaSay(text, s.chat.length) }
}
