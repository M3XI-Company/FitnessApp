import type { MealSlot } from './types'

export const MEALS: { slot: MealSlot; label: string; emoji: string; share: number }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🥣', share: 0.25 },
  { slot: 'lunch', label: 'Lunch', emoji: '🥗', share: 0.35 },
  { slot: 'dinner', label: 'Dinner', emoji: '🍽️', share: 0.3 },
  { slot: 'snack', label: 'Snacks', emoji: '🍎', share: 0.1 },
]

export const defaultMeal = (d = new Date()): MealSlot => {
  const h = d.getHours()
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}
