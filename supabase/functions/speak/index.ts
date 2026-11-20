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
 * When ELEVENLABS_API_KEY is set, the sound is made by ElevenLabs instead
 * (clearer voices, and quick enough to feel like a conversation), and the
 * hosted server is only the fallback if that fails. The reply is then MP3.
 *
 * Secrets: VOICE_SERVER_URL, VOICE_KEY (set with `supabase secrets set`).
 * Optional: ELEVENLABS_API_KEY, ELEVENLABS_MODEL (default eleven_flash_v2_5).
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: SPEAK_DAILY_LIMIT (default 300 spoken replies per device per day).
 */
import { createClient } from '@supabase/supabase-js'

const SERVER = Deno.env.get('VOICE_SERVER_URL')?.replace(/\/+$/, '')
const KEY = Deno.env.get('VOICE_KEY') ?? ''
const EL_KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? ''
const EL_MODEL = Deno.env.get('ELEVENLABS_MODEL') ?? 'eleven_flash_v2_5'
// the ElevenLabs voice that stands in for each of the app's voices: same accent and kind of voice
const EL_VOICES: Record<string, string> = {
  bf_emma: 'Xb7hH8MSUJpSbSDYk0k2', // Alice, British
  bf_isabella: 'pFZP5JQG7iQjIQuC4Bku', // Lily, British
  bm_george: 'JBFqnCBsd6RMkjVDRZzb', // George, British
  bm_fable: 'onwK4e9ZLuTAKqWW03F9', // Daniel, British
  af_heart: 'EXAVITQu4vr4xnSDxMaL', // Sarah, American
  af_bella: 'cgSgspJ2msm6clMCkdW9', // Jessica, American
  am_michael: 'cjVigY5qzO86Huf0OWal', // Eric, American
  am_puck: 'bIHbv24MWmeRgasZH58o', // Will, American
}
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
  if (!SERVER && !EL_KEY) return json(503, { error: 'not_configured' })

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
    if (EL_KEY && EL_VOICES[voice]) {
      const el = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICES[voice]}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': EL_KEY, Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: EL_MODEL }),
        signal: ctrl.signal,
      })
      if (el.ok) {
        const sound = await el.arrayBuffer()
        await db.from('ai_usage').insert({ device_hash, user_id: null, feature: 'speak', model: EL_MODEL, input_tokens: text.length, output_tokens: 0, outcome: 'ok', cost_usd: 0 })
        return new Response(sound, { headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
      }
      // out of characters, a bad key, or the service is down: the hosted voice carries on
      console.error('elevenlabs answered', el.status)
      if (!SERVER) return json(502, { error: 'upstream' })
    }
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
