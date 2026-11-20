/**
 * POST /functions/v1/records
 * Body: { device, action: 'sync', add: [set], remove: [id] } | { device, action: 'pull' }
 *
 * The record of the workouts someone has done, kept in the app's own
 * database (table workout_sets) and nowhere else. The phone sends each set
 * as it is logged. `pull` gives a signed-in person their sets back, so the
 * record follows them to a new phone.
 *
 * A person is known by the hash of their app install id; when they are
 * signed in, their account id is stored beside it.
 *
 * Auto-provided: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SetSchema = z.object({
  id: z.string().min(4).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exerciseId: z.string().min(1).max(60),
  weight: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(1000),
})
const BodySchema = z.discriminatedUnion('action', [
  z.object({ device: z.string().regex(/^[0-9a-f-]{16,64}$/i), action: z.literal('sync'), add: z.array(SetSchema).max(500), remove: z.array(z.string().max(40)).max(500) }),
  z.object({ device: z.string().regex(/^[0-9a-f-]{16,64}$/i), action: z.literal('pull') }),
])

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  let raw: unknown
  try { raw = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return json(400, { error: 'invalid_request' })
  const body = parsed.data
  const owner = await sha256(body.device)

  // the account, when the person is signed in (the app's public key is not an account)
  let userId: string | null = null
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (token && token !== ANON) { const { data } = await db.auth.getUser(token); userId = data.user?.id ?? null }

  if (body.action === 'sync') {
    if (body.remove.length) {
      const { error } = await db.from('workout_sets').delete().eq('owner', owner).in('id', body.remove)
      if (error) return json(500, { error: 'failed' })
    }
    if (body.add.length) {
      const rows = body.add.map((s) => ({ owner, id: s.id, user_id: userId, date: s.date, exercise_id: s.exerciseId, weight: s.weight, reps: s.reps }))
      const { error } = await db.from('workout_sets').upsert(rows, { onConflict: 'owner,id' })
      if (error) return json(500, { error: 'failed' })
    }
    // sets logged before signing in join the account once there is one
    if (userId) await db.from('workout_sets').update({ user_id: userId }).eq('owner', owner).is('user_id', null)
    return json(200, { ok: true, added: body.add.length, removed: body.remove.length })
  }

  // pull: everything recorded for this phone, and for this account on any phone
  const q = db.from('workout_sets').select('id, date, exercise_id, weight, reps').order('date', { ascending: true }).limit(5000)
  const { data, error } = await (userId ? q.or(`owner.eq.${owner},user_id.eq.${userId}`) : q.eq('owner', owner))
  if (error) return json(500, { error: 'failed' })
  return json(200, { sets: (data ?? []).map((r) => ({ id: r.id, date: r.date, exerciseId: r.exercise_id, weight: Number(r.weight), reps: r.reps })) })
})
