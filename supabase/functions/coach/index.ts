/**
 * POST /functions/v1/coach
 * Body: {
 *   device: <app install uuid>,
 *   messages: [{ role: 'user' | 'coach', text }]   // the recent conversation, oldest first
 *   context: { profile, targets, routine, activity, exercises: [...], recipes: [...] }
 * }
 *
 * The AI coach. The app is a single chat, so the coach also chooses which card
 * (the day's plan or the guided workout) the app shows under a reply. It talks
 * with the user and, when they ask for it, proposes a
 * weekly workout routine and a meal plan. It may only pick from the exercise
 * and recipe ids the app sends (the output schema is built from those ids), it
 * never sets weights (the app's progression rules do) and it never invents
 * calorie numbers (the app calculates targets). The app re-validates every
 * proposal before the user can apply it.
 *
 * Nothing is stored except a usage row (no messages, no raw device id). The
 * Anthropic key lives only here.
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`).
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: COACH_MONTHLY_LIMIT (default 150 messages per device per month).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
// USD per token for claude-opus-5-5 ($4 / $20 per million) — for the cost ledger
const PRICE = { input: 4 / 1_000_000, output: 20 / 1_000_000 }
const MONTHLY_LIMIT = Number(Deno.env.get('COACH_MONTHLY_LIMIT') ?? '150')
const MAX_MESSAGES = 16
const MAX_MESSAGE_CHARS = 2000
const MAX_CONTEXT_CHARS = 16000

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---- input contract ----------------------------------------------------------
const Id = z.string().regex(/^[a-z0-9-]{1,40}$/)
const BodySchema = z.object({
  device: z.string().regex(/^[0-9a-f-]{16,64}$/i),
  messages: z.array(z.object({ role: z.enum(['user', 'coach']), text: z.string().min(1).max(MAX_MESSAGE_CHARS) })).min(1).max(MAX_MESSAGES),
  context: z.object({
    exercises: z.array(z.object({ id: Id, name: z.string().max(60), muscle: z.string().max(20), equipment: z.string().max(20), level: z.string().max(20) })).min(1).max(80),
    recipes: z.array(z.object({ id: Id, name: z.string().max(80), kcal: z.number(), protein: z.number() })).max(60),
  }).passthrough(),
})

// ---- output contract ---------------------------------------------------------
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
/** cards the app can show under the reply */
const SHOW = ['none', 'today', 'tomorrow', 'workout'] as const
const ResultSchema = z.object({
  reply: z.string(),
  update_routine: z.boolean(),
  routine_days: z.array(z.object({
    day: z.enum(DAYS), title: z.string(), focus: z.string(),
    items: z.array(z.object({ exercise_id: z.string(), sets: z.number(), reps: z.string() })),
  })),
  update_meal_plan: z.boolean(),
  meal_days: z.array(z.object({ day: z.enum(DAYS), recipe_ids: z.array(z.string()) })),
  show: z.enum(SHOW).optional(),
})
export type CoachResult = z.infer<typeof ResultSchema>

/** The schema is built per request so the model can only name ids the app actually has. */
const outputSchema = (exerciseIds: string[], recipeIds: string[]) => ({
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'show', 'update_routine', 'routine_days', 'update_meal_plan', 'meal_days'],
  properties: {
    reply: { type: 'string', description: 'What the coach says to the user. Plain text, no markdown. Usually one to three short sentences; at most about 120 words when explaining something.' },
    show: { type: 'string', enum: SHOW, description: 'A card the app shows under the reply. "today" or "tomorrow": that day\'s workout and meals. "workout": the step-by-step guide for today\'s workout, when the user says they are starting or continuing it. "none" otherwise.' },
    update_routine: { type: 'boolean', description: 'true only when proposing a new or changed weekly workout routine in routine_days' },
    routine_days: {
      type: 'array',
      description: 'When update_routine is true: every training day of the week (leave rest days out). Otherwise empty.',
      items: {
        type: 'object', additionalProperties: false, required: ['day', 'title', 'focus', 'items'],
        properties: {
          day: { type: 'string', enum: DAYS },
          title: { type: 'string', description: 'Short name, e.g. "Upper body A"' },
          focus: { type: 'string', description: 'Main muscles, e.g. "Chest, back, arms"' },
          items: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['exercise_id', 'sets', 'reps'],
              properties: {
                exercise_id: { type: 'string', enum: exerciseIds },
                sets: { type: 'integer', description: '2 to 4' },
                reps: { type: 'string', description: 'A rep range such as "8-12", or seconds for holds such as "30 s"' },
              },
            },
          },
        },
      },
    },
    update_meal_plan: { type: 'boolean', description: 'true only when proposing meals for the coming week in meal_days' },
    meal_days: {
      type: 'array',
      description: 'When update_meal_plan is true: recipes for each day. Otherwise empty.',
      items: {
        type: 'object', additionalProperties: false, required: ['day', 'recipe_ids'],
        properties: { day: { type: 'string', enum: DAYS }, recipe_ids: { type: 'array', items: recipeIds.length ? { type: 'string', enum: recipeIds } : { type: 'string' } } },
      },
    },
  },
})

const SYSTEM = `You are Breeze, the coach in a UK fitness and nutrition app. The app is this one conversation: there are no other screens for the user to browse, so everything they need comes from you and from the cards the app shows under your replies. You talk with one user about their training and food, and when they want it you build or adjust their weekly workout routine and their meal plan.

Keep it simple and quick. People read this on a phone, often in the gym or the kitchen. Answer in one to three short sentences unless they ask you to explain, give one clear next step, and never bury them in numbers or options.

Cards, set with the show field:
- "today" or "tomorrow" shows that day's workout and meals. Use it when the user asks what is on, what to eat, or what is next. The card lists the details, so do not repeat them in your reply.
- "workout" starts the step-by-step guide for today's workout, with a 3D figure showing the form and the muscles worked. Use it when the user says they are starting, continuing or ready to train. If todays_workout says it is a rest day or already done, say so instead and use "none".
- A routine or meal plan you propose is shown as its own card with a button to use it and, for meals, a button to copy it with ingredients.

Not built yet, so do not offer or promise them: reminders and notifications, voice, finding or messaging training partners, ordering ingredients or meal kits, and tracking by camera beyond the form check on some exercises. If asked, say plainly that it is not available yet and offer what you can do now.

What you know about the user arrives in a JSON block at the start of the conversation: their profile and goal, the daily targets the app has calculated, their current routine, how consistent they have been lately, and the exercises and recipes the app has. Treat it as facts about the user. Their name is not included, so do not use one. If it includes body_scan, that is a trainer's first-look description from a photo the user chose to share: use its focus areas and posture notes to shape exercise choice, mention it lightly and kindly if at all, and never turn it into a judgement about their body or a weight target.

How the app works, which shapes what you can decide:
- A routine names exercises, sets and rep ranges for each day. You choose those. The app, not you, sets the weight for every set from the user's own history using gradual progression, so never state weights or tell the user to add load.
- The app calculates calorie and macro targets from the user's body and goal. You may quote those targets and explain them. Do not produce different calorie numbers, and choose recipes whose totals fit the targets you were given.
- You can only use the exercises and recipes in the lists you were given.

Building a routine:
- Fit it to the goal, the activity level and anything the user tells you: days available, equipment, time per session, exercises they dislike or cannot do.
- Keep it sustainable. Two to five training days with at least one full rest day, four to seven exercises per session, two to four sets each. Beginners and people returning after a break get fewer days, simpler exercises and fewer sets. Train each major muscle group across the week and do not put the same muscles on consecutive days.
- Compound lifts come first in a session. Use rep ranges of roughly 5 to 10 for heavy compounds, 8 to 15 for accessories, and seconds for holds.
- Only set update_routine when you are actually proposing a routine. When the user is only asking a question, answer it and leave the routine alone. If you need one or two facts before you can build a good plan, ask for them first, briefly.
- When you do propose one, say in your reply what changed and why in a sentence or two. The app shows the plan itself as a card with a button to use it, so do not list the exercises in your reply.

Meal plans work the same way: set update_meal_plan only when proposing one, one to three recipes a day, and mention how the days line up with the user's targets. meals_today and meals_tomorrow are what the day cards show now. When the user asks for different meals, names ingredients or a kind of food they want or do not want, or asks to change one day, propose a plan that includes that day using the closest recipes you have, and say honestly if nothing in the list matches what they asked for.

When the user asks whether they can do more, look at their consistency. If they have kept to the routine, propose a modest step up (one more set on a couple of exercises, or one more exercise per session, not both). If they have missed sessions, say that keeping the current plan for another week will do more for them.

Safety comes before helpfulness here, because people act on what you say with their bodies:
- You give general fitness and nutrition guidance. You are not a doctor, physiotherapist or dietitian, and you do not diagnose or treat anything.
- If the user mentions pain, an injury, dizziness, chest symptoms, pregnancy, a medical condition, medication or recent surgery, tell them plainly to check with a GP or a relevant professional before training on it, and keep anything you suggest gentle and clearly optional. Do not program around an injury as if you had examined it.
- If the user is under 18, or seems to be, keep guidance general and suggest they involve a parent, guardian or coach.
- Do not support rapid weight loss, very low calorie intakes, fasting for long periods, purging, or exercising to compensate for eating. If the user describes restricting, bingeing, or distress about food or their body, respond kindly, do not give a plan aimed at losing weight, and point them to their GP or to Beat, the UK eating disorder charity.
- No advice on steroids, other performance drugs, or supplements beyond well-established basics.

Write the way a good coach talks: direct, warm and specific to this person. Plain text only, short paragraphs, British spelling.`

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function record(row: { device_hash: string; user_id: string | null; input_tokens: number; output_tokens: number; outcome: string }) {
  const cost = row.input_tokens * PRICE.input + row.output_tokens * PRICE.output
  await db.from('ai_usage').insert({ ...row, feature: 'coach', model: MODEL, cost_usd: cost })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  // without the key every request would fail upstream; say so plainly instead
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json(503, { error: 'not_configured' })

  let raw: unknown
  try { raw = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const parsedBody = BodySchema.safeParse(raw)
  if (!parsedBody.success) return json(400, { error: 'invalid_request' })
  const { device, messages, context } = parsedBody.data
  const contextText = JSON.stringify(context)
  if (contextText.length > MAX_CONTEXT_CHARS) return json(413, { error: 'context_too_large' })
  if (messages[messages.length - 1].role !== 'user') return json(400, { error: 'last_message_must_be_user' })

  // optional signed-in user (accounts arrive in milestone M1)
  let userId: string | null = null
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (auth) { const { data } = await db.auth.getUser(auth); userId = data.user?.id ?? null }

  // monthly cap per device (and per user when signed in)
  const device_hash = await sha256(device)
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('feature', 'coach').gte('created_at', since.toISOString())
    .or(userId ? `device_hash.eq.${device_hash},user_id.eq.${userId}` : `device_hash.eq.${device_hash}`)
  if ((count ?? 0) >= MONTHLY_LIMIT) return json(429, { error: 'monthly_limit', limit: MONTHLY_LIMIT })

  // The context goes first so it sits ahead of the conversation; the turns follow in order.
  // (Consecutive same-role turns are fine: the API merges them.)
  const turns: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: `<user_context>\n${contextText}\n</user_context>\n\nThis is what the app knows about me. My messages follow.` },
    ...messages.map((m): Anthropic.Beta.BetaMessageParam => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
  ]

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // if a safety classifier declines, retry on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: outputSchema(context.exercises.map((e) => e.id), context.recipes.map((r) => r.id)) } },
      system: SYSTEM,
      messages: turns,
    })
    const usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens }

    if (response.stop_reason === 'refusal') {
      await record({ device_hash, user_id: userId, ...usage, outcome: 'declined' })
      return json(422, { error: 'declined' })
    }
    if (response.stop_reason === 'max_tokens') {
      await record({ device_hash, user_id: userId, ...usage, outcome: 'error' })
      return json(502, { error: 'incomplete' })
    }
    const text = response.content.find((b) => b.type === 'text')
    let data: unknown = null
    try { data = text && text.type === 'text' ? JSON.parse(text.text) : null } catch { /* handled below */ }
    const parsed = ResultSchema.safeParse(data)
    if (!parsed.success) {
      await record({ device_hash, user_id: userId, ...usage, outcome: 'error' })
      return json(502, { error: 'bad_output' })
    }
    const r = parsed.data
    const result: CoachResult = {
      reply: r.reply.slice(0, 4000),
      show: r.show ?? 'none',
      update_routine: r.update_routine && r.routine_days.length > 0,
      // clamp to the app's limits; the app validates again before anything is applied
      routine_days: r.update_routine ? r.routine_days.slice(0, 7).map((d) => ({ ...d, items: d.items.slice(0, 8).map((i) => ({ ...i, sets: Math.max(1, Math.min(5, Math.round(i.sets))) })) })) : [],
      update_meal_plan: r.update_meal_plan && r.meal_days.length > 0,
      meal_days: r.update_meal_plan ? r.meal_days.slice(0, 7).map((d) => ({ ...d, recipe_ids: d.recipe_ids.slice(0, 4) })) : [],
    }
    await record({ device_hash, user_id: userId, ...usage, outcome: 'ok' })
    return json(200, { ...result, remaining: Math.max(0, MONTHLY_LIMIT - (count ?? 0) - 1) })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' })
    if (e instanceof Anthropic.APIError) { console.error('coach upstream error:', e.status, e.message); return json(502, { error: 'upstream', status: e.status }) }
    // name and message only: enough to diagnose from the function logs, never the request body
    console.error('coach failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return json(500, { error: 'internal' })
  }
})
