import type { FoodItem } from '../lib/types'

const f = (id: string, emoji: string, name: string, serving: string, kcal: number, protein: number, carbs: number, fat: number, grade?: FoodItem['grade']): FoodItem =>
  ({ id, emoji, name, serving, kcal, protein, carbs, fat, grade })

export const FOODS: FoodItem[] = [
  f('egg', '🥚', 'Egg, large', '1 egg (50 g)', 72, 6.3, 0.4, 4.8, 'A'),
  f('oats', '🥣', 'Rolled oats', '40 g', 150, 5, 27, 2.6, 'A'),
  f('banana', '🍌', 'Banana', '1 medium (118 g)', 105, 1.3, 27, 0.4, 'A'),
  f('apple', '🍎', 'Apple', '1 medium (182 g)', 95, 0.5, 25, 0.3, 'A'),
  f('greek-yogurt', '🥛', 'Greek yogurt, 0%', '170 g', 100, 17, 6, 0.7, 'A'),
  f('chicken', '🍗', 'Chicken breast, grilled', '150 g', 248, 46, 0, 5.4, 'A'),
  f('salmon', '🐟', 'Salmon, baked', '150 g', 312, 34, 0, 19, 'A'),
  f('rice', '🍚', 'White rice, cooked', '1 cup (158 g)', 205, 4.3, 45, 0.4, 'B'),
  f('brown-rice', '🍚', 'Brown rice, cooked', '1 cup (195 g)', 216, 5, 45, 1.8, 'A'),
  f('broccoli', '🥦', 'Broccoli', '1 cup (91 g)', 31, 2.5, 6, 0.3, 'A'),
  f('avocado', '🥑', 'Avocado', '½ fruit (100 g)', 160, 2, 8.5, 14.7, 'A'),
  f('almonds', '🌰', 'Almonds', '28 g', 164, 6, 6, 14, 'B'),
  f('pb', '🥜', 'Peanut butter', '2 tbsp (32 g)', 190, 7, 7, 16, 'C'),
  f('bread', '🍞', 'Whole-wheat bread', '1 slice (32 g)', 81, 4, 14, 1.1, 'A'),
  f('pasta', '🍝', 'Pasta, cooked', '1 cup (140 g)', 221, 8, 43, 1.3, 'B'),
  f('beef', '🥩', 'Lean beef mince 5%', '150 g', 255, 39, 0, 10.5, 'B'),
  f('tofu', '🧈', 'Firm tofu', '150 g', 216, 24, 4, 13, 'A'),
  f('whey', '🥤', 'Whey protein shake', '1 scoop (30 g)', 120, 24, 3, 1.5, 'B'),
  f('milk', '🥛', 'Semi-skimmed milk', '250 ml', 122, 8.5, 12, 4.8, 'B'),
  f('cheddar', '🧀', 'Cheddar cheese', '30 g', 121, 7.5, 0.4, 10, 'D'),
  f('potato', '🥔', 'Potato, baked', '1 medium (173 g)', 161, 4.3, 37, 0.2, 'A'),
  f('sweet-potato', '🍠', 'Sweet potato, baked', '1 medium (130 g)', 112, 2, 26, 0.1, 'A'),
  f('pizza', '🍕', 'Pizza margherita', '1 slice (107 g)', 285, 12, 36, 10, 'C'),
  f('burger', '🍔', 'Cheeseburger', '1 burger', 303, 15, 30, 14, 'D'),
  f('fries', '🍟', 'French fries', 'medium (117 g)', 365, 4, 48, 17, 'D'),
  f('cola', '🥤', 'Cola', '330 ml can', 139, 0, 35, 0, 'E'),
  f('coffee', '☕', 'Latte', '350 ml', 190, 10, 15, 10, 'B'),
  f('croissant', '🥐', 'Butter croissant', '1 (57 g)', 231, 4.7, 26, 12, 'D'),
  f('salad', '🥗', 'Mixed green salad', '1 bowl (150 g)', 35, 2, 6, 0.4, 'A'),
  f('orange', '🍊', 'Orange', '1 medium (131 g)', 62, 1.2, 15, 0.2, 'A'),
  f('berries', '🫐', 'Blueberries', '1 cup (148 g)', 84, 1.1, 21, 0.5, 'A'),
  f('chocolate', '🍫', 'Dark chocolate 70%', '20 g', 120, 1.6, 9, 8.6, 'D'),
  f('tuna', '🐟', 'Tuna in water', '1 can (112 g)', 120, 26, 0, 1, 'A'),
  f('cottage', '🥛', 'Cottage cheese', '150 g', 147, 17, 5, 6.5, 'B'),
  f('quinoa', '🌾', 'Quinoa, cooked', '1 cup (185 g)', 222, 8, 39, 3.6, 'A'),
  f('hummus', '🫘', 'Hummus', '50 g', 83, 4, 7, 4.8, 'B'),
]

export const searchFoods = (q: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return FOODS.slice(0, 12)
  return FOODS.filter((x) => x.name.toLowerCase().includes(s))
}
