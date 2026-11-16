/**
 * Client for gym search (supabase/functions/gyms): find a gym by name, brand,
 * street or town, or list the ones near the user. Results come from
 * OpenStreetMap. The user's location is only used when they ask for gyms
 * near them, is rounded to about 100 metres on the server, and is not stored.
 */
export interface Gym { id: string; name: string; address: string; town: string; postcode: string; lat: number; lon: number; km: number | null }
export type GymError = 'not_configured' | 'offline' | 'failed'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const gymSearchConfigured = () => !!(URL_BASE && ANON)

export async function searchGyms(query: { q?: string; lat?: number; lon?: number }, signal?: AbortSignal): Promise<{ ok: true; gyms: Gym[] } | { ok: false; error: GymError }> {
  if (!gymSearchConfigured()) return { ok: false, error: 'not_configured' }
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/gyms`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify(query),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(body.gyms)) return { ok: true, gyms: body.gyms as Gym[] }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'offline' }
  }
}

/** Where a gym is, in one line: "90-100 Market Street, Manchester M1 1PB". */
export const gymWhere = (g: Pick<Gym, 'address' | 'town' | 'postcode'>) => [g.address, [g.town, g.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')

/** The name saved on the profile: enough to tell two branches of the same chain apart. */
export const gymLabel = (g: Pick<Gym, 'name' | 'address' | 'town'>) => [g.name, g.address.replace(/^[\d\s-]+/, '') || g.town].filter(Boolean).join(', ').slice(0, 80)

/** "350 m" under a kilometre, otherwise "2.4 km". */
export const gymDistance = (km: number | null) => (km === null ? '' : km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} m` : `${km.toFixed(1)} km`)
