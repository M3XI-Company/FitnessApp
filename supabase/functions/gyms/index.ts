/**
 * POST /functions/v1/gyms
 * Body: { q?: string, lat?: number, lon?: number }
 *
 * Gym search. With `q` it finds gyms by name, brand, street or town, forgiving
 * typos, and puts the ones nearest the user first when a location is given.
 * With only a location it lists the gyms around it. Results come from
 * OpenStreetMap through the Photon geocoder (https://photon.komoot.io).
 *
 * The location is rounded to about 100 metres before it leaves this function
 * and nothing is stored. No secrets are needed.
 */
import { z } from 'zod'

const PHOTON = 'https://photon.komoot.io'
const AGENT = 'Breeze fitness app (gym search)'
/** what OpenStreetMap calls a gym, and the leisure centres that usually have one */
const TAGS = ['leisure:fitness_centre', 'leisure:sports_centre']
const NEARBY_KM = 6
const MAX_RESULTS = 15

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const BodySchema = z.object({
  q: z.string().max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
})

export interface Gym { id: string; name: string; address: string; town: string; postcode: string; lat: number; lon: number; km: number | null }

interface Feature {
  geometry?: { coordinates?: [number, number] }
  properties?: { osm_type?: string; osm_id?: number; name?: string; street?: string; housenumber?: string; city?: string; district?: string; locality?: string; county?: string; postcode?: string }
}

const round = (v: number) => Math.round(v * 1000) / 1000

/** Great-circle distance in kilometres. */
function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function toGym(f: Feature, here: { lat: number; lon: number } | null): Gym | null {
  const p = f.properties ?? {}
  const c = f.geometry?.coordinates
  if (!p.name || !c || !p.osm_id) return null
  const [lon, lat] = c
  return {
    id: `${p.osm_type ?? 'N'}${p.osm_id}`,
    name: p.name.slice(0, 80),
    address: [p.housenumber, p.street].filter(Boolean).join(' ').slice(0, 80),
    town: (p.city ?? p.district ?? p.locality ?? p.county ?? '').slice(0, 60),
    postcode: (p.postcode ?? '').slice(0, 12),
    lat, lon,
    km: here ? Math.round(distanceKm(here.lat, here.lon, lat, lon) * 10) / 10 : null,
  }
}

async function photon(path: string, params: Record<string, string>): Promise<Feature[]> {
  const url = `${PHOTON}${path}?${new URLSearchParams({ ...params, lang: 'en' })}`
  const res = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`photon ${res.status}`)
  const body = await res.json() as { features?: Feature[] }
  return body.features ?? []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  let raw: unknown
  try { raw = await req.json() } catch { return json(400, { error: 'invalid_json' }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return json(400, { error: 'invalid_request' })
  const q = (parsed.data.q ?? '').trim()
  const here = parsed.data.lat !== undefined && parsed.data.lon !== undefined ? { lat: round(parsed.data.lat), lon: round(parsed.data.lon) } : null
  if (q.length < 2 && !here) return json(400, { error: 'nothing_to_search' })

  try {
    const lists = await Promise.all(TAGS.map((tag) => q.length >= 2
      ? photon('/api', { q, limit: '10', osm_tag: tag, ...(here ? { lat: String(here.lat), lon: String(here.lon), location_bias_scale: '0.3' } : {}) })
      : photon('/reverse', { lat: String(here!.lat), lon: String(here!.lon), radius: String(NEARBY_KM), limit: tag === TAGS[0] ? '20' : '6', osm_tag: tag })))
    const seen = new Set<string>()
    const gyms: Gym[] = []
    // gyms first, then leisure centres, each list in the order the geocoder ranked it
    for (const f of lists.flat()) {
      const g = toGym(f, here)
      // one entry per place: a brand often appears twice as a point and as a building outline
      const key = g ? `${g.name.toLowerCase()}|${g.postcode || `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`}` : ''
      if (!g || seen.has(g.id) || seen.has(key)) continue
      seen.add(g.id); seen.add(key)
      gyms.push(g)
    }
    // with only a location, nearest first; with a search, the geocoder's own ranking (already biased to nearby) is kept
    if (q.length < 2) gyms.sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
    return json(200, { gyms: gyms.slice(0, MAX_RESULTS) })
  } catch (e) {
    console.error('gyms failed:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    return json(502, { error: 'search_unavailable' })
  }
})
