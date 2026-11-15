/**
 * Client for the body-scan Edge Function (supabase/functions/body-scan).
 *
 * The user chooses to take one photo of themselves. It goes to Breeze's server
 * over HTTPS, is described in coarse, neutral terms (build, muscle development,
 * posture) and is discarded: the photo is never stored, on the server or in
 * the app. Only the short description is kept on the device, so the coach can
 * tailor the plan, and the user can delete it at any time.
 *
 * Adults only (see lib/age). Configure with EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY.
 */
import { deviceId } from './foodPhoto'
import type { BodyScan } from './types'

export type BodyScanError = 'not_configured' | 'monthly_limit' | 'declined' | 'offline' | 'busy' | 'failed' | 'unusable'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const bodyScanConfigured = () => !!(URL_BASE && ANON)

export const BUILD_LABEL: Record<BodyScan['build'], string> = { slender: 'Slender frame', average: 'Balanced frame', athletic: 'Athletic frame', sturdy: 'Sturdy frame', fuller: 'Fuller frame' }
export const MUSCLE_LABEL: Record<BodyScan['muscle'], string> = { early: 'Early muscle development', developing: 'Muscle developing', developed: 'Well-developed muscle' }

export async function scanBody(base64Jpeg: string): Promise<{ ok: true; scan: BodyScan } | { ok: false; error: BodyScanError; reason?: string }> {
  if (!bodyScanConfigured()) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 90000)
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/body-scan`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ image: base64Jpeg, device: await deviceId() }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) {
      if (!body.usable) return { ok: false, error: 'unusable', reason: typeof body.reason === 'string' ? body.reason : undefined }
      return { ok: true, scan: { at: new Date().toISOString(), build: body.build, muscle: body.muscle, posture: body.posture ?? [], focusAreas: body.focus_areas ?? [], summary: body.summary ?? '', confidence: body.confidence } }
    }
    if (res.status === 429) return { ok: false, error: 'monthly_limit' }
    if (res.status === 422) return { ok: false, error: 'declined' }
    if (res.status === 503) return { ok: false, error: 'busy' }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
