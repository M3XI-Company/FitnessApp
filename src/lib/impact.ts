/**
 * What a meal does for you: share of daily targets, FSA traffic lights,
 * and nutrition/health claims shown ONLY when UK rules' conditions are met
 * (retained Regulation (EC) No 1924/2006 and the GB Nutrition and Health Claims register).
 */
import type { Macros, Targets } from './types'

export type Extra = 'fiber' | 'sugar' | 'satFat' | 'salt'
export interface Composition extends Macros { fiber: number; sugar: number; satFat: number; salt: number; grams: number; /** nutrients with an unknown value in a meaningful ingredient */ unknown: Extra[] }
export type Light = 'low' | 'medium' | 'high'

/** FSA/DHSC front-of-pack thresholds: per 100 g, plus the per-portion "high" rule for portions over 100 g */
const FSA = {
  fat: { med: 3, high: 17.5, portionHigh: 21 },
  satFat: { med: 1.5, high: 5, portionHigh: 6 },
  sugar: { med: 5, high: 22.5, portionHigh: 27 },
  salt: { med: 0.3, high: 1.5, portionHigh: 1.8 },
}

export function trafficLights(c: Composition) {
  const per100 = (v: number) => (c.grams > 0 ? (v * 100) / c.grams : 0)
  return (Object.keys(FSA) as (keyof typeof FSA)[]).map((k) => {
    const t = FSA[k]
    const p = per100(c[k])
    const level: Light = p > t.high || (c.grams > 100 && c[k] > t.portionHigh) ? 'high' : p > t.med ? 'medium' : 'low'
    return { key: k, label: { fat: 'Fat', satFat: 'Saturates', sugar: 'Sugars', salt: 'Salt' }[k], grams: c[k], per100: p, level, atLeast: k !== 'fat' && c.unknown.includes(k) }
  })
}

export interface Claim { text: string; kind: 'nutrition' | 'health'; icon: 'muscle' | 'grain' | 'leaf' | 'water' }

export function claimsFor(c: Composition): Claim[] {
  const out: Claim[] = []
  const per100 = (v: number) => (c.grams > 0 ? (v * 100) / c.grams : 0)
  const proteinEnergy = c.kcal > 0 ? (c.protein * 4) / c.kcal : 0
  if (proteinEnergy >= 0.2) out.push({ text: 'High protein', kind: 'nutrition', icon: 'muscle' })
  else if (proteinEnergy >= 0.12) out.push({ text: 'Source of protein', kind: 'nutrition', icon: 'muscle' })
  if (proteinEnergy >= 0.12) {
    out.push({ text: 'Protein contributes to a growth in muscle mass', kind: 'health', icon: 'muscle' })
    out.push({ text: 'Protein contributes to the maintenance of muscle mass and of normal bones', kind: 'health', icon: 'muscle' })
  }
  const known = (k: Extra) => !c.unknown.includes(k)
  {
    const fibre100 = per100(c.fiber), fibrePerKcal = c.kcal > 0 ? (c.fiber * 100) / c.kcal : 0
    if (known('fiber') && (fibre100 >= 6 || fibrePerKcal >= 3)) out.push({ text: 'High fibre', kind: 'nutrition', icon: 'grain' })
    else if (known('fiber') && (fibre100 >= 3 || fibrePerKcal >= 1.5)) out.push({ text: 'Source of fibre', kind: 'nutrition', icon: 'grain' })
    if (per100(c.fat) <= 3) out.push({ text: 'Low fat', kind: 'nutrition', icon: 'leaf' })
    if (known('satFat') && per100(c.satFat) <= 1.5 && (c.kcal > 0 ? (c.satFat * 9) / c.kcal : 0) <= 0.1) out.push({ text: 'Low saturated fat', kind: 'nutrition', icon: 'leaf' })
    if (known('sugar') && per100(c.sugar) <= 5) out.push({ text: 'Low sugars', kind: 'nutrition', icon: 'leaf' })
    if (known('salt') && per100(c.salt) <= 0.3) out.push({ text: 'Low salt', kind: 'nutrition', icon: 'water' })
  }
  return out
}

/** Share of each daily target that one portion provides (0–1+) */
export const shareOfDay = (m: Macros, t: Targets) => ({ kcal: m.kcal / t.kcal, protein: m.protein / t.protein, carbs: m.carbs / t.carbs, fat: m.fat / t.fat })
