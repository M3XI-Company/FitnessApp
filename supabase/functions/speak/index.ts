/**
 * POST /functions/v1/speak
 * Body: { device: <app install uuid>, text: "...", voice: "bf_emma" }
 * Returns: audio/wav
 *
 * Breeze's voice. The words are passed to the speech server we host
 * (Kokoro, scripts/voice-server.py) and the sound comes straight back. The
 * server's address and key live only here, so the app cannot be used to find
 * or flood it, and each phone is limited to a fair number of spoken replies a
 * day. Nothing that is said is stored: only a count per device.
 *
 * Secrets: VOICE_SERVER_URL, VOICE_KEY (set with `supabase secrets set`).
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: SPEAK_DAILY_LIMIT (default 300 spoken replies per device per day).
 */
import { createClient } from '@supabase/supabase-js'

const SERVER = Deno.env.get('VOICE_SERVER_URL')?.replace(/\/+$/, '')
const KEY = Deno.env.get('VOICE_KEY') ?? ''
const DAILY_LIMIT = Number(Deno.env.get('SPEAK_DAILY_LIMIT') ?? '300')
const MAX_CHARS = 1200
// keep in step with src/lib/voices.ts and scripts/voice-server.py
const VOICES = ['bf_emma', 'bf_isabella', 'bm_george', 'bm_fable', 'af_heart', 'af_bella', 'am_michael', 'am_puck']

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  if (!SERVER) return json(503, { error: 'not_configured' })

  let body: { device?: unknown; text?: unknown; voice?: unknown }
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const device = typeof body.device === 'string' && /^[0-9a-f-]{16,64}$/i.test(body.device) ? body.device : null
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_CHARS) : ''
  const voice = typeof body.voice === 'string' && VOICES.includes(body.voice) ? body.voice : null
  if (!device || !text || !voice) return json(400, { error: 'invalid_request' })

  // a fair day's talking per phone; the count is all that is kept
  const device_hash = await sha256(device)
  const since = new Date(); since.setUTCHours(0, 0, 0, 0)
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('feature', 'speak').eq('device_hash', device_hash).gte('created_at', since.toISOString())
  if ((count ?? 0) >= DAILY_LIMIT) return json(429, { error: 'daily_limit', limit: DAILY_LIMIT })

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(`${SERVER}/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-voice-key': KEY }, body: JSON.stringify({ text, voice }), signal: ctrl.signal })
    if (!res.ok) { console.error('speech server answered', res.status); return json(502, { error: 'upstream' }) }
    const sound = await res.arrayBuffer()
    await db.from('ai_usage').insert({ device_hash, user_id: null, feature: 'speak', model: 'kokoro-82m', input_tokens: text.length, output_tokens: 0, outcome: 'ok', cost_usd: 0 })
    return new Response(sound, { headers: { ...CORS, 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('speak failed:', e instanceof Error ? e.name : String(e))
    return json(504, { error: 'upstream_timeout' })
  } finally {
    clearTimeout(timer)
  }
})
