/**
 * POST /functions/v1/body-scan
 * Body: { image: <base64 JPEG, ≤ 1.5 MB>, device: <app install uuid> }
 *
 * Looks at one photo the user has chosen to take of themselves and describes,
 * in coarse and neutral terms, their current build and posture so the coach can
 * tailor a training plan. It deliberately does NOT estimate weight, body-fat
 * percentage, age, attractiveness or health, and it never identifies anyone.
 *
 * The photo is analysed and discarded. Nothing is stored except a usage row
 * (no image, no result, no raw device id). The Anthropic key lives only here.
 *
 * Secrets: ANTHROPIC_API_KEY. Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: BODY_SCAN_MONTHLY_LIMIT (default 6 scans per device per month).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
// USD per token for claude-opus-5-5 ($4 / $20 per million) — for the cost ledger
const PRICE = { input: 4 / 1_000_000, output: 20 / 1_000_000 }
const MAX_IMAGE_B64 = 2_000_000 // ≈ 1.5 MB of JPEG
const MONTHLY_LIMIT = Number(Deno.env.get('BODY_SCAN_MONTHLY_LIMIT') ?? '6')

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---- output contract -------------------------------------------------------
const BUILDS = ['slender', 'average', 'athletic', 'sturdy', 'fuller'] as const
const MUSCLE = ['early', 'developing', 'developed'] as const
const AREAS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Glutes', 'Legs'] as const
const ResultSchema = z.object({
  usable: z.boolean(),
  reason: z.string(),
  photo_quality: z.enum(['good', 'ok', 'poor']),
  build: z.enum(BUILDS),
  muscle: z.enum(MUSCLE),
  posture: z.array(z.string()),
  focus_areas: z.array(z.enum(AREAS)),
  summary: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
})
export type BodyScanResult = z.infer<typeof ResultSchema>

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['usable', 'reason', 'photo_quality', 'build', 'muscle', 'posture', 'focus_areas', 'summary', 'confidence'],
  properties: {
    usable: { type: 'boolean', description: 'true only when the photo clearly shows one clothed adult from roughly head to knee or further, well enough to describe their build' },
    reason: { type: 'string', description: 'When usable is false: one short sentence for the user saying why and how to retake it. Otherwise empty.' },
    photo_quality: { type: 'string', enum: ['good', 'ok', 'poor'] },
    build: { type: 'string', enum: BUILDS, description: 'Overall frame, in neutral words. Use "average" when unsure or when usable is false.' },
    muscle: { type: 'string', enum: MUSCLE, description: 'Visible muscle development. Use "early" when unsure or when usable is false.' },
    posture: { type: 'array', items: { type: 'string' }, description: 'Up to three short, neutral posture observations a trainer would note, e.g. "shoulders sit slightly forward". Empty when nothing stands out or the angle does not show it.' },
    focus_areas: { type: 'array', items: { type: 'string', enum: AREAS }, description: 'Up to three areas that would benefit most from training emphasis, for balance and posture.' },
    summary: { type: 'string', description: 'Two sentences to the user: what you see as a starting point and what training emphasis follows. Encouraging, factual, no judgement.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
}

const SYSTEM = `You help a UK fitness app tailor a training plan. The user has chosen to take one photo of themselves and send it so their plan can fit their starting point. You look at it the way a good personal trainer does at a first session: to see overall frame, how much muscle is already developed, and posture.

What to return:
- build: the overall frame in neutral terms.
- muscle: how much muscle development is visible.
- posture: at most three observations, only ones the photo actually shows. A front-on photo cannot show most posture issues, so leave this empty when in doubt.
- focus_areas: at most three areas where extra training emphasis would help balance and posture.
- summary: two sentences spoken to the user. Describe a starting point and the emphasis that follows from it.

How to speak about a body: this is someone trusting you with a photo of themselves. Be factual and kind. Describe, never grade. Do not use words like overweight, skinny, flabby, out of shape or ideal, and do not compare the person to a standard. Every build is a workable starting point and your summary should read that way.

Things you must not do, because a photo cannot support them and getting them wrong harms people:
- Do not estimate weight, body-fat percentage, BMI, age or health, and do not suggest how much weight to lose or gain.
- Do not diagnose anything. A posture observation is something to work on in training, not a medical finding.
- Do not comment on attractiveness, skin, scars, injuries, disabilities, or anything other than build, muscle development and posture.
- Do not identify or guess who the person is.

Set usable to false and explain briefly in reason when:
- there is no person, more than one person, or the body is mostly out of frame or hidden;
- the photo is too dark or blurry to judge;
- the person appears to be a child or young teenager;
- the person is undressed beyond ordinary gym or swimwear. In that case just ask for a photo in gym clothes.
When usable is false, still fill the other fields with the neutral defaults.`

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function record(row: { device_hash: string; user_id: string | null; input_tokens: number; output_tokens: number; outcome: string }) {
  const cost = row.input_tokens * PRICE.input + row.output_tokens * PRICE.output
  await db.from('ai_usage').insert({ ...row, feature: 'body_scan', model: MODEL, cost_usd: cost })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json(503, { error: 'not_configured' })

  let body: { image?: unknown; device?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : ''
  const device = typeof body.device === 'string' ? body.device : ''
  if (!/^[0-9a-f-]{16,64}$/i.test(device)) return json(400, { error: 'invalid_device' })
  if (!image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) return json(413, { error: 'invalid_image' })
  if (!image.startsWith('/9j/')) return json(415, { error: 'jpeg_required' }) // JPEG magic bytes in base64

  let userId: string | null = null
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (auth) { const { data } = await db.auth.getUser(auth); userId = data.user?.id ?? null }

  const device_hash = await sha256(device)
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('feature', 'body_scan').gte('created_at', since.toISOString())
    .or(userId ? `device_hash.eq.${device_hash},user_id.eq.${userId}` : `device_hash.eq.${device_hash}`)
  if ((count ?? 0) >= MONTHLY_LIMIT) return json(429, { error: 'monthly_limit', limit: MONTHLY_LIMIT })

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // if a safety classifier declines, retry on Anthropic's recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: JSON_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: 'This is my photo. Describe my starting point so my training plan can fit me.' },
        ],
      }],
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
    const result: BodyScanResult = { ...r, posture: r.posture.slice(0, 3).map((p) => p.slice(0, 120)), focus_areas: [...new Set(r.focus_areas)].slice(0, 3), summary: r.summary.slice(0, 600), reason: r.reason.slice(0, 240) }
    await record({ device_hash, user_id: userId, ...usage, outcome: result.usable ? 'ok' : 'unusable' })
    return json(200, { ...result, remaining: Math.max(0, MONTHLY_LIMIT - (count ?? 0) - 1) })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' })
    if (e instanceof Anthropic.APIError) { console.error('body-scan upstream error:', e.status, e.message); return json(502, { error: 'upstream', status: e.status }) }
    console.error('body-scan failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return json(500, { error: 'internal' })
  }
})
