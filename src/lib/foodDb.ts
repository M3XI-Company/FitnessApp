/** Offline UK food search over CoFID 2021 (per 100 g). */
import cofid from '../data/cofid.json'
import type { FoodItem } from './types'

interface CofidFood { id: string; name: string; emoji: string; group: string; kcal: number; kj: number; protein: number | null; carbs: number | null; fat: number | null; sugar: number | null; fiber: number | null; satFat: number | null; salt: number | null }

const FOODS = (cofid as { foods: CofidFood[] }).foods
const lower = FOODS.map((f) => f.name.toLowerCase())

export const toItem = (f: CofidFood): FoodItem => ({
  id: f.id, name: f.name, emoji: f.emoji, source: 'cofid', serving: '100 g', servingG: 100,
  kcal: f.kcal, kj: f.kj, protein: f.protein ?? 0, carbs: f.carbs ?? 0, fat: f.fat ?? 0,
})

const POPULAR = ['Porridge oats, unfortified', 'Banana, flesh only', 'Eggs, chicken, whole, boiled', 'Chicken, breast, grilled without skin, meat only',
  'Rice, white, basmati, boiled in unsalted water', 'Milk, semi-skimmed, pasteurised, average', 'Yogurt, Greek style, plain', 'Bread, wholemeal, average',
  'Apples, eating, average, raw', 'Salmon, grilled', 'Broccoli, green, boiled in unsalted water', 'Potatoes, old, baked, flesh and skin']

/** Rank: every word must match; names starting with the query and shorter names first */
export function searchCofid(q: string, limit = 40): FoodItem[] {
  const words = q.toLowerCase().split(/[\s,]+/).filter(Boolean)
  if (!words.length) {
    return POPULAR.map((n) => FOODS.find((f) => f.name.toLowerCase().startsWith(n.toLowerCase().slice(0, 18)))).filter(Boolean).map((f) => toItem(f!))
  }
  const hits: { i: number; score: number }[] = []
  for (let i = 0; i < FOODS.length; i++) {
    const n = lower[i]
    if (!words.every((w) => n.includes(w))) continue
    let score = n.length
    if (n.startsWith(words[0])) score -= 100
    if (n.includes('raw') || n.includes('average')) score -= 10
    hits.push({ i, score })
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit).map((h) => toItem(FOODS[h.i]))
}

export const cofidCount = FOODS.length
export const cofidByName = (name: string) => FOODS.find((f) => f.name.toLowerCase() === name.toLowerCase())
export const allCofid = () => FOODS

/**
 * Best CoFID candidates for a free-text query from the photo model.
 * Tries every word first, then relaxes by dropping trailing words, so
 * "chicken breast grilled skinless" still finds "Chicken, breast, grilled…".
 */
export function matchCofid(query: string, limit = 6): FoodItem[] {
  const words = query.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1)
  for (let n = words.length; n > 0; n--) {
    const hits = searchCofid(words.slice(0, n).join(' '), limit)
    if (hits.length) return hits
  }
  return []
}
