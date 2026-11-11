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

/** Offline demo products so the scanner is testable without a camera or network */
const DEMO: Record<string, Omit<Product, 'id' | 'barcode' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'serving'>> = {
  '5000159484695': { name: 'Chocolate Bar', brand: 'Demo Snacks', emoji: '🍫', servingG: 45, per100: { kcal: 488, protein: 4.6, carbs: 60, fat: 25, sugar: 49, satFat: 9.6, salt: 0.6, fiber: 1.4 }, nova: 4, additives: 3, allergens: ['milk', 'peanuts'] },
  '3017620422003': { name: 'Hazelnut Cocoa Spread', brand: 'Demo Foods', emoji: '🥄', servingG: 15, per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9, sugar: 56.3, satFat: 10.6, salt: 0.11, fiber: 0 }, nova: 4, additives: 1, allergens: ['milk', 'nuts', 'soy'] },
  '0041196910131': { name: 'Plain Greek Yogurt 0%', brand: 'Demo Dairy', emoji: '🥛', servingG: 170, per100: { kcal: 59, protein: 10.3, carbs: 3.6, fat: 0.4, sugar: 3.2, satFat: 0.1, salt: 0.09, fiber: 0 }, nova: 1, additives: 0, allergens: ['milk'] },
  '8076809513753': { name: 'Wholegrain Penne', brand: 'Demo Pasta', emoji: '🍝', servingG: 80, per100: { kcal: 352, protein: 13, carbs: 65, fat: 2.5, sugar: 3, satFat: 0.5, salt: 0.01, fiber: 8 }, nova: 1, additives: 0, allergens: ['gluten'] },
}
export const DEMO_CODES = Object.entries(DEMO).map(([code, p]) => ({ code, name: p.name, emoji: p.emoji! }))

const fromPer100 = (code: string, base: Omit<Product, 'id' | 'barcode' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'serving'>): Product => {
  const f = base.servingG / 100
  const p: Product = {
    ...base, id: `off-${code}`, barcode: code, serving: `${base.servingG} g`,
    kcal: Math.round(base.per100.kcal * f), protein: +(base.per100.protein * f).toFixed(1),
    carbs: +(base.per100.carbs * f).toFixed(1), fat: +(base.per100.fat * f).toFixed(1),
  }
  if (!p.grade) p.grade = analyze(p).grade
  return p
}

export async function lookupBarcode(code: string): Promise<Product | null> {
  const clean = code.replace(/\D/g, '')
  if (DEMO[clean]) return fromPer100(clean, DEMO[clean])
  const fields = 'product_name,brands,nutriments,serving_quantity,nutriscore_grade,nova_group,image_front_small_url,ingredients_text,additives_n,allergens_tags'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${fields}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 1 || !json.product) return null
    const pr = json.product
    const n = pr.nutriments ?? {}
    const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0)
    const kcal = num(n['energy-kcal_100g']) || num(n['energy_100g']) / 4.184
    const g = (pr.nutriscore_grade ?? '').toUpperCase()
    return fromPer100(clean, {
      name: pr.product_name || 'Unknown product',
      brand: pr.brands?.split(',')[0],
      emoji: '🛒',
      servingG: num(pr.serving_quantity) || 100,
      per100: { kcal, protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g), sugar: num(n.sugars_100g), satFat: num(n['saturated-fat_100g']), salt: num(n.salt_100g), fiber: num(n.fiber_100g) },
      grade: (['A', 'B', 'C', 'D', 'E'].includes(g) ? g : undefined) as Product['grade'],
      image: pr.image_front_small_url,
      ingredients: pr.ingredients_text,
      additives: pr.additives_n,
      nova: pr.nova_group,
      allergens: (pr.allergens_tags ?? []).map((a: string) => a.replace(/^en:/, '')),
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
