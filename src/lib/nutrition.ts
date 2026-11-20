/**
 * Breeze nutrition engine — the ONLY place nutrition maths happens.
 * Rule: entries store exact (unrounded) values; rounding happens only for display
 * (fmt.*). Day totals are the sum of entries, so meal totals always add up to the day.
 */
import type { Activity, Amount, FoodEntry, FoodItem, Macros, MealSlot, Profile, Targets } from './types'

export type { Amount }

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

/** Energy in a kilogram of body fat, the figure the NHS and dietitians use to turn a daily deficit into a weekly loss. */
export const KCAL_PER_KG = 7700
/** The lowest daily intake the app will set: the NHS weight-loss plan's figures for women and men. */
export const kcalFloor = (p: Pick<Profile, 'sex'>) => (p.sex === 'male' ? 1500 : 1200)

/**
 * How far from maintenance the goal moves the day's calories. Losing: 500 kcal
 * under, but never more than a fifth of maintenance, so a small person is not
 * given a crash diet. Gaining: 300 over, enough to build on without piling on fat.
 */
export function goalAdjustment(p: Profile): number {
  if (p.goal === 'gain') return 300
  if (p.goal !== 'lose') return 0
  return -Math.min(500, Math.round(tdee(p) * 0.2))
}

/**
 * The body weight protein is worked out from. Protein needs follow lean mass,
 * so above a body mass index of 30 the extra weight is not counted.
 */
export const proteinWeight = (p: Pick<Profile, 'weightKg' | 'heightCm'>) => Math.min(p.weightKg, 30 * (p.heightCm / 100) ** 2)
/** Grams of protein per kilogram: 1.6 covers muscle growth in people who train (Morton et al., 2018); 2.0 protects muscle in a deficit. */
const proteinPerKg = (p: Pick<Profile, 'goal'>) => (p.goal === 'lose' ? 2.0 : p.goal === 'gain' ? 1.8 : 1.6)

/** Kilograms a week the calorie target is expected to move body weight: negative when losing. */
export const weeklyChangeKg = (p: Profile, kcal = computeTargets(p).kcal) => (Math.round((((kcal - tdee(p)) * 7) / KCAL_PER_KG) * 20) || 0) / 20

/** Human-readable assumptions behind the calculated targets (shown in the app) */
export function targetAssumptions(p: Profile) {
  const b = Math.round(bmr(p)), m = Math.round(tdee(p))
  const kcal = computeTargets(p).kcal
  const adj = kcal - Math.round(m / 10) * 10
  const weekly = Math.abs(weeklyChangeKg(p, kcal))
  return [
    `Resting energy (Mifflin–St Jeor equation): ${b} kcal from your sex, age, height and weight.`,
    `× ${ACTIVITY_FACTOR[p.activity]} for your activity level = ${m} kcal to maintain your weight.`,
    adj ? `${adj > 0 ? '+' : '−'}${Math.abs(adj)} kcal a day to ${p.goal === 'lose' ? `lose about ${weekly} kg a week` : `gain about ${weekly} kg a week`}${adj < 0 ? ` (never below ${kcalFloor(p).toLocaleString('en-GB')} kcal)` : ''}.` : 'No surplus or deficit, to maintain your weight.',
    `Protein ${proteinPerKg(p).toFixed(1)} g per kg of body weight${proteinWeight(p) < p.weightKg ? ' (counted up to a body mass index of 30)' : ''}; fat about 27% of calories; carbohydrates make up the rest.`,
    'Water: about 35 ml per kg of body weight, from drinks and food together.',
    'These are estimates for healthy adults, not medical advice. Adjust them, or ask a dietitian if you have a health condition.',
  ]
}

/** Calculated targets with any hand-set values on top */
export const effectiveTargets = (p: Profile, custom?: Partial<Targets>): Targets => ({ ...computeTargets(p), ...custom })

export const computeTargets = (p: Profile): Targets => {
  const kcal = Math.max(kcalFloor(p), Math.round((tdee(p) + goalAdjustment(p)) / 10) * 10)
  const protein = Math.round(proteinWeight(p) * proteinPerKg(p))
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
export function makeEntry(item: FoodItem, amount: Amount, meta: { id: string; date: string; meal: MealSlot; source: FoodEntry['source']; isEstimate?: boolean; dataSource?: FoodEntry['dataSource']; demo?: boolean }): FoodEntry {
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

/** Turn a logged entry back into a reusable food + amount (for saved meals, favourites, copy) */
export function entryToItem(e: FoodEntry): { item: FoodItem; amount: Amount } {
  if (e.grams) return { item: { id: e.id, name: e.name, brand: e.brand, emoji: e.emoji, source: e.dataSource, serving: `${fmt.g0(e.grams)} g`, servingG: e.grams, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }, amount: { grams: e.grams } }
  const q = e.qty || 1
  return { item: { id: e.id, name: e.name, brand: e.brand, emoji: e.emoji, source: e.dataSource, serving: e.serving, kcal: e.kcal / q, protein: e.protein / q, carbs: e.carbs / q, fat: e.fat / q }, amount: { servings: q } }
}

/** Total nutrition of a saved/custom meal */
export const mealNutrition = (items: { item: FoodItem; amount: Amount }[]) => sumMacros(items.map((i) => nutritionFor(i.item, i.amount)))
