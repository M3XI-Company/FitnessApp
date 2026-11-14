/**
 * Descriptive food and meal icons (Lucide), chosen from the food's name —
 * replaces emoji so lists look consistent and professional on every device.
 */
import { createElement, type ComponentType } from 'react'
import {
  Apple, Banana, Bean, Beef, Beer, Cake, Candy, Carrot, Cherry, Citrus, Coffee, Cookie, CookingPot, Croissant, CupSoda, Drumstick, Egg,
  Fish, Grape, IceCreamCone, LeafyGreen, Milk, Nut, Pizza, Sandwich, Shrimp, Soup, Sunrise, Utensils, UtensilsCrossed, Wheat, Wine,
  Moon, Sun, Cookie as Snack, type LucideProps,
} from 'lucide-react-native'
import { View } from 'react-native'
import { C } from '../theme'

type L = ComponentType<LucideProps>
const RULES: [RegExp, L][] = [
  [/prawn|shrimp|crab|lobster|mussel/i, Shrimp],
  [/salmon|cod|tuna|mackerel|sardine|haddock|fish/i, Fish],
  [/chicken|turkey|duck|drumstick/i, Drumstick],
  [/beef|steak|lamb|pork|ham|bacon|mince|burger|sausage|chilli/i, Beef],
  [/\begg/i, Egg],
  [/milk|yog|quark|cheese|cottage|fromage|smoothie|shake/i, Milk],
  [/soup|stew|dal|curry|casserole/i, Soup],
  [/salad|lettuce|rocket|spinach|kale|broccoli|cabbage|greens|pak choi/i, LeafyGreen],
  [/carrot/i, Carrot],
  [/bean|lentil|chickpea|edamame|houmous|tofu/i, Bean],
  [/banana/i, Banana],
  [/apple|pear/i, Apple],
  [/orange|lemon|lime|satsuma|clementine|citrus|grapefruit/i, Citrus],
  [/grape|raisin/i, Grape],
  [/berr|cherr|plum/i, Cherry],
  [/nut|almond|peanut|cashew|seed/i, Nut],
  [/croissant|pastry/i, Croissant],
  [/sandwich|wrap|toast|tortilla|burrito/i, Sandwich],
  [/bread|oat|porridge|cereal|rice|pasta|noodle|couscous|quinoa|wheat|flour/i, Wheat],
  [/pizza/i, Pizza],
  [/cake|gateau|brownie|muffin/i, Cake],
  [/biscuit|cookie|cracker/i, Cookie],
  [/ice cream/i, IceCreamCone],
  [/chocolate|sweet|candy|sugar|jam|honey/i, Candy],
  [/coffee|latte|tea\b|espresso/i, Coffee],
  [/cola|juice|soda|squash|drink|water/i, CupSoda],
  [/beer|lager|cider/i, Beer],
  [/wine|spirit|gin|vodka|whisky/i, Wine],
  [/potato|chips|crisps|sweet potato/i, CookingPot],
]

export const foodIconFor = (name: string): L => RULES.find(([re]) => re.test(name))?.[1] ?? Utensils

/** Rounded tile with the food's icon */
export function FoodIcon({ name, size = 44, bg = C.accentSoft, color = C.accent }: { name: string; size?: number; bg?: string; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {createElement(foodIconFor(name), { size: size * 0.5, color, strokeWidth: 1.8 })}
    </View>
  )
}

const MEAL_ICON: Record<string, L> = { breakfast: Sunrise, lunch: Sun, dinner: Moon, snack: Snack }
/** Icon for a meal category (custom categories use cutlery) */
export function MealIcon({ slot, size = 44, bg = C.accentSoft, color = C.accent }: { slot: string; size?: number; bg?: string; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {createElement(MEAL_ICON[slot] ?? UtensilsCrossed, { size: size * 0.5, color, strokeWidth: 1.8 })}
    </View>
  )
}
