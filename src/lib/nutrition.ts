import type { Activity, Macros, Profile, Targets } from './types'

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

export const sumMacros = (items: Macros[]): Macros =>
  items.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )

/** Epley estimated one-rep max */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))

export const round = (n: number, d = 0) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
