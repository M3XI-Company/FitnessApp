/**
 * What the chat shows without asking the coach: the day's briefing, the
 * meals for a day, the copyable meal plan and how long a session should take.
 * Everything here is worked out on the phone from the user's own plan.
 */
import { exerciseById } from '../data/exercises'
import { addDays, prettyDate, todayKey, uid } from './date'
import { allRecipes, recipeById, scaledGrams, type ComputedRecipe } from './recipes'
import { dayProgress } from './routine'
import type { AppState, ChatMessage, RoutineItem, Targets } from './types'

/** Seconds of rest advised between sets: longer for heavy lifts, shorter for core and conditioning. */
export function restSeconds(exerciseId: string): number {
  const ex = exerciseById(exerciseId)
  if (!ex) return 90
  if (ex.equipment === 'Barbell' || ex.level === 'Advanced') return 150
  if (ex.muscle === 'Core' || ex.muscle === 'Cardio') return 45
  return 90
}

const WORK_SECONDS = 45
const WARM_UP_MIN = 5

/** How long a set of exercises should take, in minutes, rounded to the nearest five. No clock runs: this is guidance. */
export function sessionMinutes(items: Pick<RoutineItem, 'exerciseId' | 'sets'>[], warmUp = true): number {
  if (!items.length) return 0
  const secs = items.reduce((a, it) => a + it.sets * (WORK_SECONDS + restSeconds(it.exerciseId)), 0)
  return Math.max(5, Math.round((secs / 60 + (warmUp ? WARM_UP_MIN : 0)) / 5) * 5)
}

/** A stable number from a string, so a day's suggestion does not change each time it is shown. */
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295 }

const MEALS_PER_DAY = 3
const suggestions = new Map<string, ComputedRecipe[]>()

/**
 * Three recipes whose totals come closest to the day's calorie and protein
 * targets. The same date always gives the same answer; different dates lean
 * towards different recipes so the week is not one meal repeated.
 */
export function suggestMeals(targets: Pick<Targets, 'kcal' | 'protein'>, date: string): ComputedRecipe[] {
  const key = `${date}|${targets.kcal}|${targets.protein}`
  const hit = suggestions.get(key)
  if (hit) return hit
  const all = allRecipes()
  let best: ComputedRecipe[] = all.slice(0, MEALS_PER_DAY)
  let bestScore = Infinity
  const lean = all.map((r) => hash(`${date}:${r.recipe.id}`) * 0.25)
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) for (let c = b + 1; c < all.length; c++) {
    const kcal = all[a].perServing.kcal + all[b].perServing.kcal + all[c].perServing.kcal
    const protein = all[a].perServing.protein + all[b].perServing.protein + all[c].perServing.protein
    // being over on calories counts double: the plan should never push past the target
    const off = (kcal - targets.kcal) / targets.kcal
    const score = (off > 0 ? off * 2 : -off) + Math.max(0, (targets.protein - protein) / targets.protein) * 0.6 + lean[a] + lean[b] + lean[c]
    if (score < bestScore) { bestScore = score; best = [all[a], all[b], all[c]] }
  }
  suggestions.set(key, best)
  return best
}

/**
 * How much of each recipe to eat so the day's meals add up to the calorie
 * target: 1, 1.5 or 2 servings, never a figure that takes the day over target.
 */
export function portionFor(targets: Pick<Targets, 'kcal'>, recipes: ComputedRecipe[]): number {
  const kcal = recipes.reduce((a, r) => a + r.perServing.kcal, 0)
  if (!kcal) return 1
  return Math.max(1, Math.min(2, Math.floor((targets.kcal / kcal) * 2) / 2))
}
export const portionLabel = (portion: number) => (portion === 1 ? '1 serving' : `${portion} servings`)

export interface DayMeals { date: string; recipes: ComputedRecipe[]; planned: boolean; portion: number; kcal: number; protein: number }

/** The meals for a date: the user's plan when there is one, otherwise a suggestion that fits their targets. */
export function mealsFor(s: AppState, date: string): DayMeals {
  const plannedRecipes = (s.boxedPlan[date] ?? []).map(recipeById).filter((r): r is ComputedRecipe => !!r)
  const planned = plannedRecipes.length > 0
  const recipes = planned ? plannedRecipes : suggestMeals(s.targets, date)
  const portion = portionFor(s.targets, recipes)
  return {
    date, recipes, planned, portion,
    kcal: Math.round(recipes.reduce((a, r) => a + r.perServing.kcal, 0) * portion),
    protein: Math.round(recipes.reduce((a, r) => a + r.perServing.protein, 0) * portion),
  }
}

/** A meal plan as plain text with the ingredients for the portion to eat, ready to paste into notes or a message. */
export function mealPlanText(days: Pick<DayMeals, 'date' | 'recipes' | 'portion'>[]): string {
  const out: string[] = ['Breeze meal plan']
  for (const d of days) {
    const kcal = Math.round(d.recipes.reduce((a, r) => a + r.perServing.kcal, 0) * d.portion)
    const protein = Math.round(d.recipes.reduce((a, r) => a + r.perServing.protein, 0) * d.portion)
    out.push('', `${prettyDate(d.date)} (${kcal} kcal, ${protein} g protein)`)
    d.recipes.forEach((r, i) => {
      out.push(`${i + 1}. ${r.recipe.title}, ${portionLabel(d.portion)}: ${Math.round(r.perServing.kcal * d.portion)} kcal, ${Math.round(r.perServing.protein * d.portion)} g protein, ${r.minutes} min`)
      out.push(`   ${scaledGrams(r, d.portion).map((x) => `${Math.round(x.grams)} g ${x.label}`).join(', ')}`)
    })
  }
  return out.join('\n')
}

/** What the user typed, when it is something the app can answer straight away. */
export type LocalIntent = 'start' | 'today' | 'tomorrow' | 'reminders'
export function localIntent(text: string): LocalIntent | null {
  const q = text.toLowerCase().trim()
  if (q.length > 80) return null
  // a question about starting ("should I start a new routine?") is for the coach, not a signal to begin
  const question = /^(should|can|could|how|why|when|what|which|is|do|does|will|would)\b/.test(q) || /\bnew\b/.test(q)
  if (!question && (/\b(start|starting|begin|beginning|continue|resume|ready)\b.*\b(workout|routine|session|training|exercis\w*)\b/.test(q) || /^(let'?s (go|train|start)|i'?m (at|in) the gym)\b/.test(q))) return 'start'
  // only short, plain asks for the plan; anything more specific goes to the coach
  const ask = (day: string) => new RegExp(`^(show me |what'?s |what is |what am i doing |what do i have |what'?s the plan |my plan )?(on |planned )?(for )?${day}[?]?$`).test(q)
  if (ask('tomorrow')) return 'tomorrow'
  if (ask('today')) return 'today'
  // a bare ask for reminders shows the times; one that names times goes to the coach
  if (/^(set up |set |turn on |change |show |edit )?(my )?(meal |workout |daily )?(reminders?|notifications?)( please)?[?]?$/.test(q)) return 'reminders'
  return null
}

const coach = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: uid(), role: 'coach', text, ...extra })

/** The answer to a local intent. */
export function localAnswer(s: AppState, intent: Exclude<LocalIntent, 'reminders'>, today = todayKey()): ChatMessage {
  if (intent === 'tomorrow') {
    const date = addDays(today, 1)
    const p = dayProgress(s, date)
    return coach(p.status === 'rest' ? 'Tomorrow is a rest day. Here is the plan.' : `Tomorrow is ${p.day.title}, about ${sessionMinutes(p.items)} minutes. Here is the plan.`, { day: date })
  }
  const p = dayProgress(s, today)
  if (intent === 'today') return coach(p.status === 'rest' ? 'Today is a rest day. Here is the plan.' : `Today is ${p.day.title}. Here is the plan.`, { day: today })
  if (p.status === 'rest') return coach('Today is a rest day, so there is nothing to start. A walk or some stretching is plenty. If you would rather train today, ask me to move your days around.')
  if (p.status === 'done') return coach('You have already finished today’s workout. Rest up, and I will have the next one ready tomorrow.')
  return coach(`${p.status === 'started' ? 'Picking up where you left off' : 'Let’s go'}. I will take you through it one exercise at a time. Tap Set done after each set.`, { guide: today })
}
