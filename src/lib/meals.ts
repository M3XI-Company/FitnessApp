import { useStore } from './store'
import type { MealCategory, MealSlot } from './types'

/** Built-in meal categories (share = suggested part of the day's calories) */
export const MEALS: MealCategory[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🥣', share: 0.25 },
  { slot: 'lunch', label: 'Lunch', emoji: '🥗', share: 0.35 },
  { slot: 'dinner', label: 'Dinner', emoji: '🍽️', share: 0.3 },
  { slot: 'snack', label: 'Snacks', emoji: '🍎', share: 0.1 },
]

/** Built-in plus the user's own categories (e.g. "Pre-workout", "Second breakfast") */
export function useMeals(): MealCategory[] {
  const { state } = useStore()
  return [...MEALS, ...state.mealCategories]
}

export const mealLabel = (slot: MealSlot, all: MealCategory[]) => all.find((m) => m.slot === slot)?.label ?? 'Snacks'

export const defaultMeal = (d = new Date()): MealSlot => {
  const h = d.getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}
