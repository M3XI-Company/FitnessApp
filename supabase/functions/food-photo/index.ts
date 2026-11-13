/**
 * POST /functions/v1/food-photo
 * Body: { image: <base64 JPEG, ≤ 1.5 MB>, device: <app install uuid> }
 *
 * Identifies foods in a photo and estimates portion weights with Claude vision.
 * Returns food NAMES + GRAMS only — the app looks nutrition up in the UK CoFID
 * database, so calories never come from the model. Nothing is stored except a
 * usage row (no image, no raw device id). The Anthropic key lives only here.
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`).
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: FOOD_PHOTO_MONTHLY_LIMIT (default 30 scans per device per month).
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'
// USD per token for claude-opus-5-5 ($4 / $20 per million) — for the cost ledger
const PRICE = { input: 4 / 1_000_000, output: 20 / 1_000_000 }
const MAX_IMAGE_B64 = 2_000_000 // ≈ 1.5 MB of JPEG
const MONTHLY_LIMIT = Number(Deno.env.get('FOOD_PHOTO_MONTHLY_LIMIT') ?? '30')

const anthropic = new Anthropic() // reads ANTHROPIC_API_KEY
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---- output contract -------------------------------------------------------
const ItemSchema = z.object({
  name: z.string(),
  cofid_query: z.string(),
  grams: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string(),
})
const ResultSchema = z.object({
  is_food: z.boolean(),
  items: z.array(ItemSchema),
  photo_quality: z.enum(['good', 'ok', 'poor']),
  advice: z.string(),
})
export type FoodPhotoResult = z.infer<typeof ResultSchema>

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'photo_quality', 'advice'],
  properties: {
    is_food: { type: 'boolean', description: 'false if the photo does not show food or drink' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'cofid_query', 'grams', 'confidence', 'note'],
        properties: {
          name: { type: 'string', description: 'Plain-English name a UK user would recognise, e.g. "Grilled chicken breast"' },
          cofid_query: { type: 'string', description: 'Search words in UK CoFID naming style, general to specific, e.g. "chicken breast grilled", "rice white boiled", "broccoli boiled"' },
          grams: { type: 'number', description: 'Best estimate of the edible weight in grams shown in the photo' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          note: { type: 'string', description: 'Short note on what makes the estimate uncertain, or empty' },
        },
      },
    },
    photo_quality: { type: 'string', enum: ['good', 'ok', 'poor'] },
    advice: { type: 'string', description: 'One short sentence for the user, e.g. how to take a better photo, or empty' },
  },
}

const SYSTEM = `You identify foods in meal photos for a UK nutrition-tracking app and estimate how much of each is on the plate.

Your output is matched against the UK Composition of Foods Integrated Dataset (CoFID); the app — not you — supplies all nutrition values. So:
- List each distinct food separately (e.g. "chicken breast grilled", "rice white boiled", "broccoli boiled"). For a composite dish you can't separate (lasagne, curry, pie), give the dish as one item.
- Write cofid_query in CoFID style: the main food first, then form and cooking method, using British terms (crisps, chips, courgette, aubergine, porridge, semi-skimmed milk).
- Estimate edible grams using visual cues: plate size (assume a 26 cm dinner plate unless something suggests otherwise), cutlery, packaging, hand size and typical UK portions. Do not include bones, skins you can see are left, or the plate.
- Visible added fats or sauces (butter, oil sheen, mayonnaise, gravy, dressing) should be their own item with low confidence when the amount is a guess. Do not invent hidden ingredients you can't see.
- Use confidence honestly: "high" only when the food and amount are both clear.
- If the photo shows no food or drink, set is_food to false and return no items.
- If the photo is blurry, dark or cropped, still do your best, set photo_quality accordingly and use advice to say how to retake it.
Never give calorie or nutrient numbers.`

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function record(row: { device_hash: string; user_id: string | null; input_tokens: number; output_tokens: number; outcome: string }) {
  const cost = row.input_tokens * PRICE.input + row.output_tokens * PRICE.output
  await db.from('ai_usage').insert({ ...row, feature: 'food_photo', model: MODEL, cost_usd: cost })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let body: { image?: unknown; device?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const image = typeof body.image === 'string' ? body.image.replace(/^data:image\/\w+;base64,/, '') : ''
  const device = typeof body.device === 'string' ? body.device : ''
  if (!/^[0-9a-f-]{16,64}$/i.test(device)) return json(400, { error: 'invalid_device' })
  if (!image || image.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(image)) return json(413, { error: 'invalid_image' })
  if (!image.startsWith('/9j/')) return json(415, { error: 'jpeg_required' }) // JPEG magic bytes in base64

  // optional signed-in user (accounts arrive in milestone M1)
  let userId: string | null = null
  const auth = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (auth) { const { data } = await db.auth.getUser(auth); userId = data.user?.id ?? null }

  // monthly cap per device (and per user when signed in)
  const device_hash = await sha256(device)
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('feature', 'food_photo').gte('created_at', since.toISOString())
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
          { type: 'text', text: 'Identify the foods in this photo and estimate the grams of each.' },
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
    const parsed = ResultSchema.safeParse(text && text.type === 'text' ? JSON.parse(text.text) : null)
    if (!parsed.success) {
      await record({ device_hash, user_id: userId, ...usage, outcome: 'error' })
      return json(502, { error: 'bad_output' })
    }
    // sanity-clamp grams: a single item over 2 kg is almost certainly a misread
    const result: FoodPhotoResult = {
      ...parsed.data,
      items: parsed.data.items.slice(0, 12).map((i) => ({ ...i, grams: Math.max(1, Math.min(2000, Math.round(i.grams))) })),
    }
    await record({ device_hash, user_id: userId, ...usage, outcome: result.is_food ? 'ok' : 'not_food' })
    return json(200, { ...result, remaining: Math.max(0, MONTHLY_LIMIT - (count ?? 0) - 1) })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' })
    if (e instanceof Anthropic.APIError) return json(502, { error: 'upstream', status: e.status })
    return json(500, { error: 'internal' })
  }
})
