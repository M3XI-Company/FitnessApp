/**
 * Breeze nutrition engine — the ONLY place nutrition maths happens.
 * Rule: entries store exact (unrounded) values; rounding happens only for display
 * (fmt.*). Day totals are the sum of entries, so meal totals always add up to the day.
 */
import type { Activity, FoodEntry, FoodItem, Macros, MealSlot, Profile, Targets } from './types'

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
}

/** Mifflin–St Jeor BMR */
export const bmr = (p: Profile) =>
  10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)

export const tdee = (p: Profile) => bmr(p) * ACTIVITY_FACTOR[p.activity]

/** Human-readable assumptions behind the calculated targets (shown in the app) */
export function targetAssumptions(p: Profile) {
  const b = Math.round(bmr(p)), m = Math.round(tdee(p))
  const adj = p.goal === 'lose' ? -500 : p.goal === 'gain' ? 300 : 0
  return [
    `Resting energy (Mifflin–St Jeor): ${b} kcal from your sex, age, height and weight.`,
    `× ${ACTIVITY_FACTOR[p.activity]} for your activity level = ${m} kcal to maintain your weight.`,
    adj ? `${adj > 0 ? '+' : '−'}${Math.abs(adj)} kcal a day to ${p.goal === 'lose' ? 'lose about 0.5 kg a week' : 'support gradual muscle gain'}${adj < 0 ? ' (never below 1,200 kcal)' : ''}.` : 'No surplus or deficit, to maintain your weight.',
    `Protein ${p.goal === 'maintain' ? '1.6' : '2.0'} g per kg of body weight; fat about 27% of calories; carbohydrates make up the rest.`,
    'Water: about 35 ml per kg of body weight.',
    'These are estimates for healthy adults, not medical advice. Adjust them, or ask a dietitian if you have a health condition.',
  ]
}

export const computeTargets = (p: Profile): Targets => {
  const maintenance = tdee(p)
  const adj = p.goal === 'lose' ? -500 : p.goal === 'gain' ? 300 : 0
  const kcal = Math.max(1200, Math.round((maintenance + adj) / 10) * 10)
  const protein = Math.round(p.weightKg * (p.goal === 'maintain' ? 1.6 : 2.0))
  const fat = Math.round((kcal * 0.27) / 9)
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4))
  const waterMl = Math.round((p.weightKg * 35) / 250) * 250
  return { kcal, protein, carbs, fat, waterMl }
}

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
const pick = (m: Macros): Macros => ({ kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat })

export const addMacros = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat })
export const sumMacros = (items: Macros[]): Macros => items.reduce<Macros>((a, b) => addMacros(a, pick(b)), ZERO)
export const scaleMacros = (m: Macros, factor: number): Macros => ({ kcal: m.kcal * factor, protein: m.protein * factor, carbs: m.carbs * factor, fat: m.fat * factor })
export const subtractMacros = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal - b.kcal, protein: a.protein - b.protein, carbs: a.carbs - b.carbs, fat: a.fat - b.fat })

/** How much of a food was eaten: by weight (needs item.servingG) or by servings */
export type Amount = { grams: number } | { servings: number }

/** Factor applied to a FoodItem's per-serving values */
export function amountFactor(item: Pick<FoodItem, 'servingG'>, amount: Amount): number {
  if ('grams' in amount) {
    if (!item.servingG) throw new Error('This food has no serving weight; log it by servings')
    return amount.grams / item.servingG
  }
  return amount.servings
}

/** Nutrition for an amount of a food (exact) */
export const nutritionFor = (item: FoodItem, amount: Amount): Macros => scaleMacros(pick(item), amountFactor(item, amount))

/** Build a diary entry from a food and an amount — every logging path uses this */
export function makeEntry(item: FoodItem, amount: Amount, meta: { id: string; date: string; meal: MealSlot; source: FoodEntry['source']; isEstimate?: boolean; dataSource?: FoodEntry['dataSource'] }): FoodEntry {
  const m = nutritionFor(item, amount)
  const grams = 'grams' in amount ? amount.grams : item.servingG ? item.servingG * amount.servings : undefined
  return {
    ...meta, ...m, name: item.name, brand: item.brand, emoji: item.emoji,
    serving: 'grams' in amount ? `${fmt.g0(amount.grams)} g` : item.serving,
    qty: 'servings' in amount ? amount.servings : 1,
    grams, dataSource: meta.dataSource ?? item.source,
  }
}

/** Change an entry's amount, keeping its nutrition proportional */
export function rescaleEntry(e: FoodEntry, next: { grams?: number; qty?: number }): FoodEntry {
  const f = next.grams !== undefined && e.grams ? next.grams / e.grams : next.qty !== undefined ? next.qty / (e.qty || 1) : 1
  return { ...e, ...scaleMacros(pick(e), f), ...(next.grams !== undefined ? { grams: next.grams, serving: `${fmt.g0(next.grams)} g` } : {}), ...(next.qty !== undefined ? { qty: next.qty } : {}) }
}

/** Totals for a day, and per meal slot (meal totals always sum to the day total) */
export function dayTotals(entries: FoodEntry[], date: string) {
  const day = entries.filter((e) => e.date === date)
  const byMeal: Record<string, Macros> = {}
  for (const e of day) byMeal[e.meal] = addMacros(byMeal[e.meal] ?? ZERO, pick(e))
  return { total: sumMacros(day), byMeal, entries: day }
}

export const remainingOf = (targets: Macros, consumed: Macros): Macros => subtractMacros(pick(targets), consumed)

/** Recipe nutrition from its ingredients (each ingredient's nutrition already resolved) */
export function recipeNutrition(ingredients: Macros[], servings: number) {
  if (servings <= 0) throw new Error('A recipe needs at least one serving')
  const total = sumMacros(ingredients)
  return { total, perServing: scaleMacros(total, 1 / servings) }
}

export const kcalToKj = (kcal: number) => kcal * 4.184

/** Display rounding — the same rules on every screen */
export const fmt = {
  kcal: (n: number) => Math.round(n),
  g: (n: number) => (Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n)),
  g0: (n: number) => Math.round(n),
}

/** Epley estimated one-rep max */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))

export const round = (n: number, d = 0) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
