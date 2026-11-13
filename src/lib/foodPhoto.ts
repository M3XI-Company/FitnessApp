/**
 * Client for the food-photo Edge Function (supabase/functions/food-photo).
 * The photo goes to Breeze's server over HTTPS, is analysed, and is not stored.
 * Configure with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface PhotoItem { name: string; cofid_query: string; grams: number; confidence: 'high' | 'medium' | 'low'; note: string }
export interface PhotoResult { is_food: boolean; items: PhotoItem[]; photo_quality: 'good' | 'ok' | 'poor'; advice: string; remaining: number }
export type PhotoError = 'not_configured' | 'monthly_limit' | 'declined' | 'offline' | 'busy' | 'failed'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const photoScanConfigured = () => !!(URL_BASE && ANON)

/** Random per-install id; the server only ever stores its SHA-256 hash, for fair-use limits. */
async function deviceId() {
  const key = 'breeze.device'
  let id = await AsyncStorage.getItem(key)
  if (!id) {
    const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')
    id = `${r()}${r()}-${r()}-4${r().slice(1)}-${r()}-${r()}${r()}${r()}`
    await AsyncStorage.setItem(key, id)
  }
  return id
}

export async function analysePhoto(base64Jpeg: string): Promise<{ ok: true; result: PhotoResult } | { ok: false; error: PhotoError; limit?: number }> {
  if (!photoScanConfigured()) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60000)
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/food-photo`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ image: base64Jpeg, device: await deviceId() }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, result: body as PhotoResult }
    if (res.status === 429) return { ok: false, error: 'monthly_limit', limit: body.limit }
    if (res.status === 422) return { ok: false, error: 'declined' }
    if (res.status === 503) return { ok: false, error: 'busy' }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}
