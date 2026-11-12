/**
 * Barcode → product lookup via the free Open Food Facts API, plus a
 * "product scanner" health analysis (traffic lights + fit to your day).
 */
import type { FoodItem } from './types'

export interface Product extends FoodItem {
  per100: { kcal: number; protein: number; carbs: number; fat: number; sugar: number; satFat: number; salt: number; fiber: number }
  servingG: number
  image?: string
  ingredients?: string
  additives?: number
  nova?: number
  allergens: string[]
  /** listed as sold in the UK on Open Food Facts */
  ukListed: boolean
  /** has energy data */
  complete: boolean
  /** 'nutriscore' when the grade comes from Open Food Facts, otherwise Breeze's own score */
  gradeSource: 'nutriscore' | 'breeze'
}

type Level = 'low' | 'medium' | 'high'
export interface Analysis {
  score: number // 0–100
  grade: NonNullable<FoodItem['grade']>
  verdict: string
  lights: { label: string; value: string; level: Level }[]
  pros: string[]
  cons: string[]
}

/** Real UK products for trying the scanner without a camera (looked up live — no stored data). */
export const SAMPLE_CODES = [
  { code: '5000157024671', name: 'Heinz Beanz', emoji: '🥫' },
  { code: '5036589200970', name: 'Yeo Valley Greek style', emoji: '🥛' },
  { code: '5010044000404', name: 'Warburtons Wholemeal', emoji: '🍞' },
  { code: '7622201148782', name: 'Cadbury Dairy Milk', emoji: '🍫' },
]

const OFF = 'https://uk.openfoodfacts.org'
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity,nutriscore_grade,nova_group,image_front_small_url,ingredients_text,additives_n,allergens_tags,countries_tags'
// Open Food Facts asks apps to identify themselves (ignored by browsers, honoured on iOS/Android)
const HEADERS = { 'User-Agent': 'Breeze/1.0 (https://github.com/M3XI-Company/FitnessApp)' }

const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0)

function fromOff(pr: any): Product {
  const n = pr.nutriments ?? {}
  const kcal = num(n['energy-kcal_100g']) || num(n['energy_100g']) / 4.184
  const g = String(pr.nutriscore_grade ?? '').toUpperCase()
  const servingG = num(pr.serving_quantity) || 100
  const per100 = { kcal, protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g), sugar: num(n.sugars_100g), satFat: num(n['saturated-fat_100g']), salt: num(n.salt_100g), fiber: num(n.fiber_100g) }
  const f = servingG / 100
  const p: Product = {
    id: `off-${pr.code}`, barcode: String(pr.code), source: 'off',
    name: pr.product_name || 'Unnamed product', brand: pr.brands?.split(',')[0]?.trim(), emoji: '🛒',
    serving: `${Math.round(servingG)} g`, servingG, per100,
    kcal: Math.round(kcal * f), kj: Math.round(kcal * 4.184 * f),
    protein: +(per100.protein * f).toFixed(1), carbs: +(per100.carbs * f).toFixed(1), fat: +(per100.fat * f).toFixed(1),
    grade: (['A', 'B', 'C', 'D', 'E'].includes(g) ? g : undefined) as Product['grade'],
    gradeSource: ['A', 'B', 'C', 'D', 'E'].includes(g) ? 'nutriscore' : 'breeze',
    image: pr.image_front_small_url, ingredients: pr.ingredients_text, additives: pr.additives_n, nova: pr.nova_group,
    allergens: (pr.allergens_tags ?? []).map((a: string) => a.replace(/^en:/, '')),
    ukListed: (pr.countries_tags ?? []).includes('en:united-kingdom'),
    complete: kcal > 0,
  }
  if (!p.grade) p.grade = analyze(p).grade
  return p
}

async function get(url: string, ms = 9000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: HEADERS })
    return res.ok ? await res.json() : null
  } catch { return null } finally { clearTimeout(timer) }
}

export type LookupResult = { ok: true; product: Product } | { ok: false; reason: 'not_found' | 'offline' }

export async function lookupBarcode(code: string): Promise<LookupResult> {
  const clean = code.replace(/\D/g, '')
  const json = await get(`${OFF}/api/v2/product/${clean}.json?fields=${FIELDS}`)
  if (json === null) return { ok: false, reason: 'offline' }
  if (json.status !== 1 || !json.product) return { ok: false, reason: 'not_found' }
  return { ok: true, product: fromOff({ code: clean, ...json.product }) }
}

/** Branded UK products by name (Open Food Facts search is rate-limited — call on explicit user action only). */
export async function searchUkProducts(q: string): Promise<Product[] | null> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=20&sort_by=unique_scans_n&fields=${FIELDS}&tagtype_0=countries&tag_contains_0=contains&tag_0=united-kingdom`
  const json = await get(url, 12000)
  if (!json) return null
  return (json.products ?? []).map(fromOff).filter((p: Product) => p.complete)
}

const level = (v: number, med: number, high: number): Level => (v > high ? 'high' : v > med ? 'medium' : 'low')

/** UK FSA front-of-pack thresholds (per 100 g) + protein, fibre and processing */
export function analyze(p: Product): Analysis {
  const x = p.per100
  const lights = [
    { label: 'Sugar', value: `${x.sugar.toFixed(1)} g`, level: level(x.sugar, 5, 22.5) },
    { label: 'Fat', value: `${x.fat.toFixed(1)} g`, level: level(x.fat, 3, 17.5) },
    { label: 'Saturates', value: `${x.satFat.toFixed(1)} g`, level: level(x.satFat, 1.5, 5) },
    { label: 'Salt', value: `${x.salt.toFixed(2)} g`, level: level(x.salt, 0.3, 1.5) },
  ]
  let score = 70
  for (const l of lights) score += l.level === 'high' ? -14 : l.level === 'medium' ? -4 : 4
  const proteinShare = x.kcal ? (x.protein * 4) / x.kcal : 0
  if (proteinShare > 0.25) score += 12
  if (x.fiber >= 6) score += 8
  if (x.kcal > 400) score -= 8
  if (p.nova === 4) score -= 10
  if ((p.additives ?? 0) >= 3) score -= 5
  score = Math.max(0, Math.min(100, Math.round(score)))
  const computed = score >= 80 ? 'A' : score >= 62 ? 'B' : score >= 45 ? 'C' : score >= 28 ? 'D' : 'E'
  const grade = p.grade ?? computed

  const pros: string[] = []
  const cons: string[] = []
  if (proteinShare > 0.25) pros.push(`High protein — ${Math.round(proteinShare * 100)}% of calories`)
  if (x.fiber >= 6) pros.push(`Good fibre — ${x.fiber} g per 100 g`)
  lights.filter((l) => l.level === 'low').forEach((l) => pros.push(`Low ${l.label.toLowerCase()}`))
  lights.filter((l) => l.level === 'high').forEach((l) => cons.push(`High ${l.label.toLowerCase()} (${l.value} / 100 g)`))
  if (p.nova === 4) cons.push('Ultra-processed (NOVA 4)')
  if ((p.additives ?? 0) > 0) cons.push(`${p.additives} additive${p.additives === 1 ? '' : 's'}`)
  if (x.kcal > 400) cons.push('Energy dense — watch the portion')

  const verdict = { A: 'Excellent choice', B: 'Good choice', C: 'Okay in moderation', D: 'Occasional treat', E: 'Best avoided' }[grade]
  return { score, grade, verdict, lights, pros, cons }
}
