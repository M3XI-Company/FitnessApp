/**
 * POST /functions/v1/interview
 * Body: {
 *   device: <app install uuid>,
 *   messages: [{ role: 'user' | 'coach', text }]   // the spoken conversation so far, oldest first
 * }
 *
 * The spoken conversation. Breeze talks with a new user out loud (or with a
 * returning one who wants to talk things through again): it asks one
 * question at a time, listens, and builds up what the app needs to make a
 * plan (the profile) plus what a good coach would want to remember (notes).
 * Each call returns the next thing to say, the profile as understood so far
 * and whether the interview is finished. The app checks every value against
 * its own limits before using it, and the user confirms the result on screen.
 *
 * Nothing is stored except a usage row (no messages, no raw device id). The
 * Anthropic key lives only here.
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`).
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: INTERVIEW_MONTHLY_LIMIT (default 120 turns per device per month).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
// the conversation is spoken, so it runs on the fast model; the main model takes over when the fast one cannot answer
const QUICK_MODEL = 'claude-haiku-5-5'
// USD per token, for the cost ledger
const PRICES: Record<string, { input: number; output: number }> = {
  [MODEL]: { input: 4 / 1_000_000, output: 20 / 1_000_000 },
  [QUICK_MODEL]: { input: 0.1 / 1_000_000, output: 0.5 / 1_000_000 },
}
const MONTHLY_LIMIT = Number(Deno.env.get('INTERVIEW_MONTHLY_LIMIT') ?? '120')
const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 1200

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---- streaming ---------------------------------------------------------------
type Emit = (event: string, data: unknown) => void
type Outcome = { status: number; body: unknown }
const out = (status: number, body: unknown): Outcome => ({ status, body })

/**
 * Server-sent events for clients that ask for them: the model's thinking
 * (a summary, as it happens) and then one `result` event carrying the same
 * status and body the plain response would have had.
 */
function sse(run: (emit: Emit) => Promise<Outcome>) {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event, data) => {
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch { /* the client went away */ }
      }
      emit('result', await run(emit))
      try { controller.close() } catch { /* already closed */ }
    },
  })
  return new Response(body, { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
}

const BodySchema = z.object({
  device: z.string().regex(/^[0-9a-f-]{16,64}$/i),
  // empty at the very start: the coach opens the conversation
  messages: z.array(z.object({ role: z.enum(['user', 'coach']), text: z.string().min(1).max(MAX_MESSAGE_CHARS) })).max(MAX_MESSAGES),
  // what the app already holds, for a user who has set up before and wants to talk things through again
  known: z.object({
    profile: z.object({ age: z.number(), sex: z.string().max(10), height_cm: z.number(), weight_kg: z.number(), target_weight_kg: z.number(), goal: z.string().max(10), activity: z.string().max(12) }),
    memory: z.array(z.string().max(200)).max(30),
  }).optional(),
  stream: z.boolean().optional(),
})

const SEX = ['male', 'female', 'unknown'] as const
const GOAL = ['lose', 'maintain', 'gain', 'unknown'] as const
const ACTIVITY = ['sedentary', 'light', 'moderate', 'active', 'athlete', 'unknown'] as const

const ResultSchema = z.object({
  say: z.string(),
  done: z.boolean(),
  profile: z.object({
    name: z.string(), age: z.number(), sex: z.enum(SEX), height_cm: z.number(), weight_kg: z.number(), target_weight_kg: z.number(),
    goal: z.enum(GOAL), activity: z.enum(ACTIVITY),
  }),
  notes: z.string(),
})
export type InterviewResult = z.infer<typeof ResultSchema>

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['say', 'done', 'profile', 'notes'],
  properties: {
    say: { type: 'string', description: 'What Breeze says out loud next. Spoken English: one or two short sentences, at most about 35 words, ending in one question unless the interview is done. No lists, symbols, emoji or markdown.' },
    done: { type: 'boolean', description: 'true once everything needed is known, or the conversation should end. When true, say is a short closing line.' },
    profile: {
      type: 'object', additionalProperties: false,
      required: ['name', 'age', 'sex', 'height_cm', 'weight_kg', 'target_weight_kg', 'goal', 'activity'],
      description: 'What is known so far. Use "" , 0 or "unknown" for anything the user has not said yet. Never guess.',
      properties: {
        name: { type: 'string', description: 'First name as the user wants to be called, or ""' },
        age: { type: 'integer', description: 'Years, or 0' },
        sex: { type: 'string', enum: SEX, description: 'Which figures to use for the calorie calculation' },
        height_cm: { type: 'number', description: 'Centimetres, converted from feet and inches if needed, or 0' },
        weight_kg: { type: 'number', description: 'Kilograms, converted from stone or pounds if needed, or 0' },
        target_weight_kg: { type: 'number', description: 'Kilograms the user wants to reach, or 0 when they gave none' },
        goal: { type: 'string', enum: GOAL, description: 'lose = lose weight or fat, gain = build muscle or gain weight, maintain = stay the same weight (fitter, stronger, healthier)' },
        activity: { type: 'string', enum: ACTIVITY, description: 'Overall weekly activity including their job: sedentary (desk, little exercise), light (1 to 3 sessions), moderate (3 to 5), active (6 to 7), athlete (twice a day or a physical job)' },
      },
    },
    notes: { type: 'string', description: 'What a coach should remember about this person, in plain sentences, at most about 120 words: training experience, days and time available, equipment or gym, how they eat and cook, foods they avoid, sleep and work pattern, what has stopped them before, and anything they should check with a GP. Only what the user actually said. Refer to the user as "they"; never put their name in the notes.' },
  },
}

const SYSTEM = `You are Breeze, a fitness and nutrition coach, meeting a new user for the first time. This is a spoken conversation: the app reads your words aloud and turns the user's speech into text, so their side may contain mis-heard words. Your job in this conversation is to understand the person well enough to build them a training and meal plan, the way a good coach would in a first chat.

How to talk:
- One question at a time. One or two short sentences. Plain spoken English, British spelling, no lists or symbols, nothing that sounds odd read aloud.
- Start by saying hello in a sentence and asking what to call them.
- Show you listened: a few words reflecting what they just said, then the next question. Do not give advice, plans or opinions yet; that comes after the conversation.
- Follow what they say. If they mention something that matters (an old injury, shift work, hating vegetables, a wedding in June), ask one follow-up about it before moving on.
- If an answer is unclear or sounds mis-heard (an age of 3, a weight of 800), ask again simply rather than guessing.
- If they do not want to answer something, accept it and move on.

What you need before you finish:
- For the plan's numbers: first name, age, height, weight, which figures to use for the calorie maths (ask plainly: "For the calorie maths, should I use male or female figures?"), their main goal and, if they have one, a target weight, and how active their week is including their job.
- For the coaching: what training they have done before, how many days and how long they can train, where they train and what equipment they have, how they eat on a normal day and whether they cook, foods they avoid or cannot eat, how they sleep, and what has got in the way before.
- Ask once whether there are any injuries or health conditions you should know about. Note what they say. Do not diagnose or advise on it; if they mention one, say they should check with their GP before training on it and that the plan will stay gentle around it.

Accept any units and convert them yourself: feet and inches to centimetres, stone or pounds to kilograms. Aim for eight to twelve questions in total; people will give several answers at once, so never ask for something they have already told you.

Come prepared, and make it a conversation, not a form. You already have your questions: open with their name, then what brought them here now, then let what they say choose the order of the rest. Sound like a person who is interested in them: react to what they said in a few words of your own before the next question, use what they told you earlier ("you said mornings are the only time, so"), and vary how you ask. Never say "thanks for that", "that's noted" or "got it" as a reply on its own, never read their answer back to them as a list, and never ask a vague question such as "tell me more about what has been hard": ask something specific they can answer in a sentence. If they ask you something, answer it briefly and carry on. If what you heard is a fragment or makes no sense, say you did not catch it and ask again.

Never set done to true while any of these is still unknown: first name, age, height, weight, male or female figures, main goal, and how active their week is. Ask for what is missing first, two things at a time at most.

Fill in profile with everything known so far on every turn, and keep notes up to date. Leave anything unknown as "", 0 or "unknown".

Finishing: when you have the numbers and a real picture of their habits, set done to true and say a short, warm closing line that tells them the next step is to check what you heard. Also finish early, kindly, if:
- they say they are under 16: explain that Breeze is for people aged 16 and over, and set done;
- they describe restricting food, purging, or serious distress about eating or their body: respond with care, do not ask about weight goals, suggest speaking to their GP or to Beat, the UK eating disorder charity, and set done;
- they ask to stop.

Returning users: when the first message carries a <known> block, this person has already set up. It holds their current details and your notes about them from earlier conversations. Do not start again and do not ask their name. Greet them briefly, then ask what has changed or what has been getting in the way lately. Follow what they bring: a niggle from training, a routine that is not fitting their week, meals they are tired of, a new goal, a new schedule. Ask follow-ups until you understand the real problem, check anything in your notes that looks out of date, and confirm their weight if it has not come up. Start profile from the known values and change only what they tell you has changed. In notes, write only what is new or different from the known notes. This is usually four to seven questions.

If the conversation has no messages yet, give your opening line.`

/** The value of the "say" field once its closing quote has arrived in the partial JSON, else null. */
function earlySay(partial: string): string | null {
  const key = partial.indexOf('"say"')
  const colon = key < 0 ? -1 : partial.indexOf(':', key)
  const open = colon < 0 ? -1 : partial.indexOf('"', colon + 1)
  if (open < 0) return null
  const BACKSLASH = String.fromCharCode(92)
  for (let i = open + 1; i < partial.length; i++) {
    if (partial[i] === BACKSLASH) { i++; continue }
    if (partial[i] === '"') { try { return JSON.parse(partial.slice(open, i + 1)) as string } catch { return null } }
  }
  return null
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function record(row: { device_hash: string; user_id: string | null; input_tokens: number; output_tokens: number; outcome: string; model: string }) {
  const price = PRICES[row.model] ?? PRICES[MODEL]
  const cost = row.input_tokens * price.input + row.output_tokens * price.output
  await db.from('ai_usage').insert({ ...row, feature: 'interview', cost_usd: cost })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json(503, { error: 'not_configured' })

  let raw: unknown
  try { raw = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const parsedBody = BodySchema.safeParse(raw)
  if (!parsedBody.success) return json(400, { error: 'invalid_request' })
  const { device, messages, known, stream: wantStream } = parsedBody.data
  if (messages.length && messages[messages.length - 1].role !== 'user') return json(400, { error: 'last_message_must_be_user' })

  let userId: string | null = null
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (auth) { const { data } = await db.auth.getUser(auth); userId = data.user?.id ?? null }

  const device_hash = await sha256(device)
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('feature', 'interview').gte('created_at', since.toISOString())
    .or(userId ? `device_hash.eq.${device_hash},user_id.eq.${userId}` : `device_hash.eq.${device_hash}`)
  if ((count ?? 0) >= MONTHLY_LIMIT) return json(429, { error: 'monthly_limit', limit: MONTHLY_LIMIT })

  // the API needs a user turn first; the opening has none, so the app's side starts it
  const turns: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: known ? `I already use the app and want to talk things through again.\n<known>\n${JSON.stringify(known)}\n</known>` : 'A new user has opened the app and is ready to talk.' },
    ...messages.map((m): Anthropic.Beta.BetaMessageParam => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
  ]

  const format = { type: 'json_schema' as const, schema: OUTPUT_SCHEMA }
  const run = async (emit?: Emit, quick = true): Promise<Outcome> => {
  const model = quick ? QUICK_MODEL : MODEL
  try {
    const stream = quick
      ? anthropic.beta.messages.stream({ model, max_tokens: 2000, thinking: { type: 'disabled' }, output_config: { effort: 'low', format }, system: SYSTEM, messages: turns })
      : anthropic.beta.messages.stream({
      model,
      max_tokens: 4000,
      // if a safety classifier declines, retry on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // a readable summary of the reasoning, so the app can show what the coach is working out
      thinking: { type: 'adaptive', display: 'summarized' },
      // low effort: this is a live conversation, so a quick reply matters more than deep deliberation
      output_config: { effort: 'low', format },
      system: SYSTEM,
      messages: turns,
    })
    let thought = ''
    let partial = ''
    let said = false
    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue
      if (event.delta.type === 'thinking_delta') { thought += event.delta.thinking; emit?.('thinking', { text: thought.slice(-700) }) }
      else if (event.delta.type === 'text_delta' && !said) {
        partial += event.delta.text
        // the words to speak come first in the answer: send them the moment they are complete,
        // so the app can start talking while the rest (profile, notes) is still being written
        const say = earlySay(partial)
        if (say !== null) { said = true; emit?.('say', { say: say.slice(0, 600) }) }
      }
    }
    const response = await stream.finalMessage()
    const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }

    if (quick && (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens')) return run(emit, false)
    if (response.stop_reason === 'refusal') {
      await record({ device_hash, user_id: userId, ...usage, model, outcome: 'declined' })
      return out(422, { error: 'declined' })
    }
    if (response.stop_reason === 'max_tokens') {
      await record({ device_hash, user_id: userId, ...usage, model, outcome: 'error' })
      return out(502, { error: 'incomplete' })
    }
    const text = response.content.find((b) => b.type === 'text')
    let data: unknown = null
    try { data = text && text.type === 'text' ? JSON.parse(text.text) : null } catch { /* handled below */ }
    const parsed = ResultSchema.safeParse(data)
    if (!parsed.success) {
      if (quick) return run(emit, false)
      await record({ device_hash, user_id: userId, ...usage, model, outcome: 'error' })
      return out(502, { error: 'bad_output' })
    }
    const r = parsed.data
    await record({ device_hash, user_id: userId, ...usage, model, outcome: 'ok' })
    return out(200, { say: r.say.slice(0, 600), done: r.done, profile: r.profile, notes: r.notes.slice(0, 1200) })
  } catch (e) {
    if (quick && !(e instanceof Anthropic.RateLimitError)) return run(emit, false)
    if (e instanceof Anthropic.RateLimitError) return out(503, { error: 'busy' })
    if (e instanceof Anthropic.APIError) { console.error('interview upstream error:', e.status, e.message); return out(502, { error: 'upstream', status: e.status }) }
    console.error('interview failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return out(500, { error: 'internal' })
  }
  }

  if (!wantStream) { const r = await run(); return json(r.status, r.body) }
  return sse(run)
})
