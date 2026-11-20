/**
 * Questions the coach asks with answers to tap (the `questions` part of a
 * reply). Whatever the server sends is tidied here before it is shown, and
 * the person's choices are turned back into a message.
 */
export interface CoachQuestion { question: string; options: string[] }

export const MAX_QUESTIONS = 4

/** The usable questions from a reply: a question and at least two different answers each. */
export function cleanQuestions(raw: unknown): CoachQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: CoachQuestion[] = []
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue
    const { question, options } = q as { question?: unknown; options?: unknown }
    if (typeof question !== 'string' || !Array.isArray(options)) continue
    const text = question.replace(/\s+/g, ' ').trim().slice(0, 120)
    const answers = [...new Set(options.filter((o): o is string => typeof o === 'string').map((o) => o.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean))].slice(0, 5)
    if (text && answers.length >= 2 && !out.some((x) => x.question === text)) out.push({ question: text, options: answers })
  }
  return out.slice(0, MAX_QUESTIONS)
}

/** What the person chose, as the message sent back to the coach: one line for each question. */
export const answersText = (questions: CoachQuestion[], picked: Record<number, string>) =>
  questions.map((q, i) => `${q.question.replace(/[?:]\s*$/, '')}: ${picked[i] ?? ''}`).join('\n')
