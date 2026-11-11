import type { MealSlot } from '../lib/types'

export interface Ingredient { name: string; qty: number; unit: string; aisle: 'Produce' | 'Protein' | 'Dairy' | 'Pantry' | 'Bakery' | 'Frozen' }

export interface BoxedMeal {
  id: string
  name: string
  slot: MealSlot
  emoji: string
  tags: string[]
  minutes: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  waterMl: number // water content / suggested pairing
  ingredients: Ingredient[]
  steps: string[]
}

export const BOXED_MEALS: BoxedMeal[] = [
  {
    id: 'overnight-oats', name: 'Blueberry Protein Overnight Oats', slot: 'breakfast', emoji: '🫐', tags: ['High protein', 'Meal prep'], minutes: 5,
    kcal: 420, protein: 32, carbs: 52, fat: 9, waterMl: 250,
    ingredients: [
      { name: 'Rolled oats', qty: 50, unit: 'g', aisle: 'Pantry' },
      { name: 'Greek yogurt 0%', qty: 150, unit: 'g', aisle: 'Dairy' },
      { name: 'Blueberries', qty: 80, unit: 'g', aisle: 'Produce' },
      { name: 'Whey protein', qty: 15, unit: 'g', aisle: 'Pantry' },
      { name: 'Chia seeds', qty: 10, unit: 'g', aisle: 'Pantry' },
    ],
    steps: ['Mix oats, yogurt, whey and chia with 80 ml water.', 'Top with blueberries.', 'Refrigerate overnight.'],
  },
  {
    id: 'egg-wrap', name: 'Spinach & Feta Egg Wrap', slot: 'breakfast', emoji: '🌯', tags: ['Quick', 'Vegetarian'], minutes: 10,
    kcal: 380, protein: 27, carbs: 28, fat: 17, waterMl: 0,
    ingredients: [
      { name: 'Eggs', qty: 3, unit: 'pcs', aisle: 'Dairy' },
      { name: 'Whole-wheat tortilla', qty: 1, unit: 'pcs', aisle: 'Bakery' },
      { name: 'Baby spinach', qty: 40, unit: 'g', aisle: 'Produce' },
      { name: 'Feta', qty: 25, unit: 'g', aisle: 'Dairy' },
    ],
    steps: ['Wilt spinach in a pan.', 'Scramble eggs with spinach.', 'Wrap with crumbled feta.'],
  },
  {
    id: 'chicken-bowl', name: 'Lemon Herb Chicken Rice Bowl', slot: 'lunch', emoji: '🍗', tags: ['High protein', 'Meal prep'], minutes: 25,
    kcal: 560, protein: 48, carbs: 58, fat: 13, waterMl: 0,
    ingredients: [
      { name: 'Chicken breast', qty: 160, unit: 'g', aisle: 'Protein' },
      { name: 'Brown rice', qty: 70, unit: 'g', aisle: 'Pantry' },
      { name: 'Broccoli', qty: 120, unit: 'g', aisle: 'Produce' },
      { name: 'Lemon', qty: 0.5, unit: 'pcs', aisle: 'Produce' },
      { name: 'Olive oil', qty: 5, unit: 'ml', aisle: 'Pantry' },
    ],
    steps: ['Cook rice.', 'Season chicken with lemon, herbs, oil; grill 6 min per side.', 'Steam broccoli and assemble.'],
  },
  {
    id: 'tuna-salad', name: 'Mediterranean Tuna Salad', slot: 'lunch', emoji: '🥗', tags: ['Low carb', 'No cook'], minutes: 10,
    kcal: 410, protein: 38, carbs: 18, fat: 20, waterMl: 150,
    ingredients: [
      { name: 'Tuna in water', qty: 1, unit: 'can', aisle: 'Pantry' },
      { name: 'Cucumber', qty: 100, unit: 'g', aisle: 'Produce' },
      { name: 'Cherry tomatoes', qty: 100, unit: 'g', aisle: 'Produce' },
      { name: 'Chickpeas', qty: 60, unit: 'g', aisle: 'Pantry' },
      { name: 'Olive oil', qty: 10, unit: 'ml', aisle: 'Pantry' },
    ],
    steps: ['Chop vegetables.', 'Combine with tuna and chickpeas.', 'Dress with oil, lemon, salt, pepper.'],
  },
  {
    id: 'salmon-plate', name: 'Teriyaki Salmon & Sweet Potato', slot: 'dinner', emoji: '🐟', tags: ['Omega-3'], minutes: 30,
    kcal: 610, protein: 40, carbs: 55, fat: 24, waterMl: 0,
    ingredients: [
      { name: 'Salmon fillet', qty: 150, unit: 'g', aisle: 'Protein' },
      { name: 'Sweet potato', qty: 200, unit: 'g', aisle: 'Produce' },
      { name: 'Green beans', qty: 100, unit: 'g', aisle: 'Produce' },
      { name: 'Teriyaki sauce (light)', qty: 20, unit: 'ml', aisle: 'Pantry' },
    ],
    steps: ['Roast sweet potato wedges 25 min at 200°C.', 'Glaze salmon and bake 12 min.', 'Steam green beans.'],
  },
  {
    id: 'beef-stirfry', name: 'Lean Beef & Veggie Stir-Fry', slot: 'dinner', emoji: '🥩', tags: ['High protein', 'Quick'], minutes: 20,
    kcal: 540, protein: 44, carbs: 48, fat: 17, waterMl: 0,
    ingredients: [
      { name: 'Lean beef strips', qty: 150, unit: 'g', aisle: 'Protein' },
      { name: 'Jasmine rice', qty: 60, unit: 'g', aisle: 'Pantry' },
      { name: 'Bell pepper', qty: 1, unit: 'pcs', aisle: 'Produce' },
      { name: 'Snap peas', qty: 80, unit: 'g', aisle: 'Produce' },
      { name: 'Soy sauce', qty: 15, unit: 'ml', aisle: 'Pantry' },
    ],
    steps: ['Cook rice.', 'Sear beef on high heat 2 min.', 'Add veg and soy, toss 3 min.'],
  },
  {
    id: 'tofu-curry', name: 'Coconut Tofu Curry', slot: 'dinner', emoji: '🍛', tags: ['Vegan'], minutes: 25,
    kcal: 520, protein: 26, carbs: 50, fat: 24, waterMl: 100,
    ingredients: [
      { name: 'Firm tofu', qty: 150, unit: 'g', aisle: 'Protein' },
      { name: 'Light coconut milk', qty: 100, unit: 'ml', aisle: 'Pantry' },
      { name: 'Curry paste', qty: 20, unit: 'g', aisle: 'Pantry' },
      { name: 'Spinach', qty: 60, unit: 'g', aisle: 'Produce' },
      { name: 'Basmati rice', qty: 60, unit: 'g', aisle: 'Pantry' },
    ],
    steps: ['Press and cube tofu, pan-fry until golden.', 'Add paste, coconut milk, simmer 8 min.', 'Stir in spinach; serve with rice.'],
  },
  {
    id: 'protein-snack', name: 'Cottage Cheese & Berries Cup', slot: 'snack', emoji: '🍓', tags: ['High protein', 'No cook'], minutes: 2,
    kcal: 210, protein: 22, carbs: 20, fat: 5, waterMl: 50,
    ingredients: [
      { name: 'Cottage cheese', qty: 150, unit: 'g', aisle: 'Dairy' },
      { name: 'Mixed berries', qty: 80, unit: 'g', aisle: 'Frozen' },
      { name: 'Honey', qty: 5, unit: 'g', aisle: 'Pantry' },
    ],
    steps: ['Spoon cottage cheese into a cup.', 'Top with berries and honey.'],
  },
  {
    id: 'hummus-box', name: 'Hummus Veggie Snack Box', slot: 'snack', emoji: '🥕', tags: ['Vegan', 'No cook'], minutes: 5,
    kcal: 230, protein: 8, carbs: 24, fat: 11, waterMl: 100,
    ingredients: [
      { name: 'Hummus', qty: 60, unit: 'g', aisle: 'Dairy' },
      { name: 'Carrots', qty: 80, unit: 'g', aisle: 'Produce' },
      { name: 'Cucumber', qty: 80, unit: 'g', aisle: 'Produce' },
      { name: 'Wholegrain crackers', qty: 20, unit: 'g', aisle: 'Bakery' },
    ],
    steps: ['Slice vegetables into sticks.', 'Pack with hummus and crackers.'],
  },
]

export const boxedById = (id: string) => BOXED_MEALS.find((m) => m.id === id)
