/**
 * Recipe engine. Nutrition, allergens and diet labels are DERIVED from the
 * ingredients (each a CoFID food + grams) — never typed in by hand.
 */
import { cofidItem } from './foodDb'
import { fmt, nutritionFor, recipeNutrition, scaleMacros } from './nutrition'
import type { FoodItem, Macros } from './types'
import { RECIPES, type Recipe } from '../data/recipes'

export type Allergen = 'Cereals containing gluten' | 'Milk' | 'Eggs' | 'Fish' | 'Crustaceans' | 'Molluscs' | 'Peanuts' | 'Tree nuts' | 'Sesame' | 'Soya' | 'Celery' | 'Mustard' | 'Lupin' | 'Sulphites'

/** UK/EU 14 allergens, matched on CoFID ingredient names */
const ALLERGEN_WORDS: [Allergen, RegExp][] = [
  ['Cereals containing gluten', /\b(bread|pasta|noodles, egg|couscous|bulgur|wheat|flour|tortilla|porridge oats|oats|barley|rye|crispbread|soy sauce)\b/i],
  // dairy words, excluding plant foods that share the word (peanut butter, coconut milk, cocoa butter)
  ['Milk', /\b(?<!(peanut|coconut|cocoa|almond|oat|soya) )(milk|yogurt|cheese|butter|cream|fromage|quark|custard)\b/i],
  ['Eggs', /\beggs?\b/i],
  ['Fish', /\b(salmon|cod|tuna|mackerel|sardines?|haddock|fish)\b/i],
  ['Crustaceans', /\b(prawns?|crab|lobster|shrimps?)\b/i],
  ['Molluscs', /\b(mussels?|squid|oysters?|scallops?)\b/i],
  ['Peanuts', /\bpeanuts?\b/i],
  ['Tree nuts', /\b(almonds?|cashews?|walnuts?|hazelnuts?|pecans?|pistachios?|brazil nuts?)\b/i],
  ['Sesame', /\b(sesame|houmous|tahini)\b/i],
  ['Soya', /\b(soy|soya|tofu|edamame)\b/i],
  ['Celery', /\bceler(y|iac)\b/i],
  ['Mustard', /\bmustard\b/i],
]
const MEAT_FISH = /\b(chicken|turkey|beef|pork|lamb|ham|bacon|veal|duck|salmon|cod|tuna|mackerel|sardines?|haddock|fish|prawns?|crab|stock, chicken|gelatine)\b/i
const ANIMAL = /\b(?<!(peanut|coconut|cocoa|almond|oat|soya) )(milk|yogurt|cheese|butter|cream|fromage|quark|custard|eggs?|honey)\b/i

export type RecipeTag = 'high-protein' | 'muscle-building' | 'weight-management' | 'pre-workout' | 'post-workout' | 'quick' | 'budget' | 'vegetarian' | 'vegan'
export const TAG_LABEL: Record<RecipeTag, string> = {
  'high-protein': 'High protein', 'muscle-building': 'Muscle building', 'weight-management': 'Weight management',
  'pre-workout': 'Pre-workout', 'post-workout': 'Post-workout', quick: 'Under 15 min', budget: 'Budget', vegetarian: 'Vegetarian', vegan: 'Vegan',
}
/** How each tag is decided — shown to users so labels are transparent */
export const TAG_RULE: Record<RecipeTag, string> = {
  'high-protein': 'At least 25 g protein per serving and at least 25% of calories from protein.',
  'muscle-building': 'At least 30 g protein and 450 kcal per serving.',
  'weight-management': 'At most 450 kcal and at least 20 g protein per serving.',
  quick: 'Ready in 15 minutes or less (prep plus cooking).',
  vegetarian: 'No meat, fish or seafood in the ingredients.',
  vegan: 'No animal products in the ingredients (including dairy, eggs and honey).',
  'pre-workout': 'Breeze editorial pick: mostly carbohydrate, easy to digest, moderate fat.',
  'post-workout': 'Breeze editorial pick: protein plus carbohydrate for recovery.',
  budget: 'Breeze editorial pick: built from low-cost UK supermarket staples. No price data yet.',
}

export interface ComputedRecipe {
  recipe: Recipe
  ingredients: { label: string; grams: number; note?: string; food: FoodItem; nutrition: Macros }[]
  total: Macros
  perServing: Macros
  gramsPerServing: number
  allergens: Allergen[]
  tags: RecipeTag[]
  minutes: number
  /** the recipe as a loggable food (1 serving) */
  asFood: FoodItem
}

const cache = new Map<string, ComputedRecipe>()

export function computeRecipe(recipe: Recipe): ComputedRecipe {
  const hit = cache.get(recipe.id)
  if (hit) return hit
  const ingredients = recipe.ingredients.map((i) => {
    const food = cofidItem(i.food)
    if (!food) throw new Error(`Recipe ${recipe.id}: unknown CoFID food ${i.food}`)
    return { label: i.label, grams: i.grams, note: i.note, food, nutrition: nutritionFor(food, { grams: i.grams }) }
  })
  const { total, perServing } = recipeNutrition(ingredients.map((i) => i.nutrition), recipe.servings)
  const names = ingredients.map((i) => i.food.name).join(' ; ')
  const allergens = [...new Set([
    ...ALLERGEN_WORDS.filter(([, re]) => ingredients.some((i) => re.test(i.food.name))).map(([a]) => a),
    ...(recipe.alsoContains ?? []),
  ])]
  const vegetarian = !MEAT_FISH.test(names)
  const vegan = vegetarian && !ANIMAL.test(names)
  const minutes = recipe.prepMin + recipe.cookMin
  const proteinShare = perServing.kcal ? (perServing.protein * 4) / perServing.kcal : 0
  const tags: RecipeTag[] = []
  if (perServing.protein >= 25 && proteinShare >= 0.25) tags.push('high-protein')
  if (perServing.protein >= 30 && perServing.kcal >= 450) tags.push('muscle-building')
  if (perServing.kcal <= 450 && perServing.protein >= 20) tags.push('weight-management')
  for (const t of recipe.editorial) tags.push(t)
  if (minutes <= 15) tags.push('quick')
  if (vegan) tags.push('vegan')
  if (vegetarian) tags.push('vegetarian')
  const gramsPerServing = ingredients.reduce((a, i) => a + i.grams, 0) / recipe.servings
  const out: ComputedRecipe = {
    recipe, ingredients, total, perServing, gramsPerServing, allergens, tags, minutes,
    asFood: { id: `recipe-${recipe.id}`, name: recipe.title, emoji: recipe.emoji, source: 'recipe', serving: `1 serving (${fmt.g0(gramsPerServing)} g)`, ...perServing },
  }
  cache.set(recipe.id, out)
  return out
}

export const allRecipes = () => RECIPES.map(computeRecipe)
export const recipeById = (id: string) => { const r = RECIPES.find((x) => x.id === id); return r ? computeRecipe(r) : undefined }

/** Ingredient grams scaled to a number of servings */
export const scaledGrams = (c: ComputedRecipe, servings: number) => c.ingredients.map((i) => ({ ...i, grams: (i.grams * servings) / c.recipe.servings, nutrition: scaleMacros(i.nutrition, servings / c.recipe.servings) }))

/**
 * How well one serving fits what's left of the day — protein-aware, not calories alone.
 * Returns a 0–100 score and plain-English reasons.
 */
export function fitFor(perServing: Macros, remaining: Macros): { score: number; reasons: string[]; fits: boolean } {
  const reasons: string[] = []
  const kcalLeft = Math.max(0, remaining.kcal)
  const proteinLeft = Math.max(0, remaining.protein)
  const fits = perServing.kcal <= kcalLeft + 50
  let score = 50
  if (kcalLeft > 0) {
    const use = perServing.kcal / kcalLeft
    if (fits) { score += 20 - Math.abs(use - 0.45) * 20; reasons.push(`${fmt.kcal(perServing.kcal)} kcal fits the ${fmt.kcal(kcalLeft)} kcal you have left`) }
    else { score -= Math.min(40, (perServing.kcal - kcalLeft) / 10); reasons.push(`${fmt.kcal(perServing.kcal - kcalLeft)} kcal over what you have left today`) }
  } else {
    score -= 30
    reasons.push('You’ve reached your calories for today')
  }
  if (proteinLeft > 5) {
    const share = Math.min(1, perServing.protein / proteinLeft)
    score += share * 30
    if (perServing.protein >= 15) reasons.push(`${fmt.g(perServing.protein)} g protein covers ${Math.round(share * 100)}% of the protein you still need`)
  } else if (perServing.protein >= 15) {
    reasons.push('Your protein target is already met')
  }
  const density = perServing.kcal ? (perServing.protein * 4) / perServing.kcal : 0
  score += density * 20
  if (remaining.fat < perServing.fat && remaining.fat >= 0) { score -= 8; reasons.push(`Higher in fat than you have left (${fmt.g(perServing.fat)} g)`) }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, fits }
}
