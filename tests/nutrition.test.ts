/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amountFactor, computeTargets, goalAdjustment, kcalFloor, proteinWeight, tdee, weeklyChangeKg, dayTotals, fmt, makeEntry, nutritionFor, recipeNutrition, rescaleEntry, scaleMacros, sumMacros } from '../src/lib/nutrition'
import { searchCofid } from '../src/lib/foodDb'
import type { FoodEntry, FoodItem, Macros, Profile } from '../src/lib/types'

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`)
const closeM = (a: Macros, b: Macros, eps = 1e-9) => { for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) close(a[k], b[k], eps) }

const oats = searchCofid('porridge oats')[0]
const chicken = searchCofid('chicken breast grilled')[0]
const product: FoodItem = { id: 'off-1', name: 'Beanz', source: 'off', serving: '207 g', servingG: 207, kcal: 168, protein: 10, carbs: 32, fat: 1 }
const meta = (id: string, meal: FoodEntry['meal'] = 'lunch') => ({ id, date: '2026-11-13', meal, source: 'search' as const })

test('CoFID foods are per 100 g and log by grams', () => {
  assert.equal(oats.servingG, 100)
  closeM(nutritionFor(oats, { grams: 40 }), scaleMacros(oats, 0.4))
  closeM(nutritionFor(oats, { grams: 100 }), nutritionFor(oats, { servings: 1 }))
})

test('entries keep exact values; rounding only happens for display', () => {
  const e = makeEntry(oats, { grams: 37 }, meta('a'))
  close(e.kcal, oats.kcal * 0.37)
  assert.equal(e.grams, 37)
  assert.equal(e.serving, '37 g')
  assert.equal(fmt.kcal(140.6), 141)
  assert.equal(fmt.g(4.26), 4.3)
  assert.equal(fmt.g(32.4), 32)
})

test('scanner path: servings of a packaged product', () => {
  const e = makeEntry(product, { servings: 1.5 }, meta('b'))
  close(e.kcal, 168 * 1.5)
  close(e.grams!, 207 * 1.5)
  assert.equal(e.dataSource, 'off')
})

test('the same food logged by search and by photo gives identical nutrition', () => {
  const viaSearch = makeEntry(chicken, { grams: 150 }, meta('c'))
  const viaPhoto = makeEntry(chicken, { grams: 150 }, { ...meta('d'), source: 'photo', dataSource: 'ai', isEstimate: true })
  closeM(viaSearch, viaPhoto)
  assert.equal(viaPhoto.isEstimate, true)
})

test('portion edits rescale proportionally and round-trip exactly', () => {
  const e = makeEntry(chicken, { grams: 120 }, meta('e'))
  const bigger = rescaleEntry(e, { grams: 180 })
  close(bigger.protein, e.protein * 1.5)
  closeM(rescaleEntry(bigger, { grams: 120 }), e, 1e-9)
  const p = makeEntry(product, { servings: 1 }, meta('f'))
  close(rescaleEntry(p, { qty: 2 }).kcal, 336)
})

test('meal totals always add up to the day total', () => {
  const foods = [oats, chicken, product]
  const meals: FoodEntry['meal'][] = ['breakfast', 'lunch', 'dinner', 'snack']
  const entries: FoodEntry[] = []
  for (let i = 0; i < 60; i++) {
    const f = foods[i % 3]
    entries.push(makeEntry(f, f.source === 'off' ? { servings: 0.5 + (i % 4) * 0.5 } : { grams: 13 + i * 7 }, meta(`x${i}`, meals[i % 4])))
  }
  entries.push(makeEntry(oats, { grams: 50 }, { ...meta('other'), date: '2026-11-12' }))
  const d = dayTotals(entries, '2026-11-13')
  assert.equal(d.entries.length, 60)
  closeM(sumMacros(Object.values(d.byMeal)), d.total, 1e-6)
  closeM(d.total, sumMacros(entries.slice(0, 60)), 1e-6)
})

test('recipes: per serving × servings equals the whole recipe', () => {
  const ing = [nutritionFor(chicken, { grams: 480 }), nutritionFor(oats, { grams: 160 })]
  const r = recipeNutrition(ing, 4)
  closeM(scaleMacros(r.perServing, 4), r.total, 1e-9)
  closeM(r.total, sumMacros(ing))
  assert.throws(() => recipeNutrition(ing, 0))
})

test('logging by grams needs a serving weight', () => {
  assert.throws(() => amountFactor({}, { grams: 100 }))
  assert.equal(amountFactor({}, { servings: 2 }), 2)
})

test('targets are internally consistent and never below 1,200 kcal', () => {
  const base: Profile = { name: 'T', sex: 'female', age: 30, heightCm: 165, weightKg: 62, targetWeightKg: 58, activity: 'moderate', goal: 'lose', onboarded: true }
  for (const p of [base, { ...base, sex: 'male' as const, weightKg: 90, goal: 'gain' as const }, { ...base, weightKg: 45, heightCm: 150, activity: 'sedentary' as const, age: 60 }]) {
    const t = computeTargets(p)
    assert.ok(t.kcal >= kcalFloor(p))
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9
    assert.ok(Math.abs(fromMacros - t.kcal) / t.kcal < 0.03 || t.carbs === 50, `macros ${fromMacros} vs ${t.kcal}`)
  }
})

test('a deficit is never a crash diet, and a man is never set below 1,500 kcal', () => {
  const small: Profile = { name: 'T', sex: 'female', age: 62, heightCm: 150, weightKg: 46, targetWeightKg: 44, activity: 'sedentary', goal: 'lose', onboarded: true }
  // a fifth of a small person's maintenance is less than 500
  assert.ok(-goalAdjustment(small) < 500 && -goalAdjustment(small) <= tdee(small) * 0.2 + 1)
  assert.equal(computeTargets(small).kcal >= 1200, true)
  const man: Profile = { ...small, sex: 'male', heightCm: 160, weightKg: 52 }
  assert.ok(computeTargets(man).kcal >= 1500)
  const big: Profile = { ...small, sex: 'male', age: 30, heightCm: 180, weightKg: 95, activity: 'moderate' }
  assert.equal(goalAdjustment(big), -500)
  // 500 kcal a day under is about half a kilo a week
  assert.ok(Math.abs(weeklyChangeKg(big) + 0.45) <= 0.06, String(weeklyChangeKg(big)))
  assert.equal(weeklyChangeKg({ ...big, goal: 'maintain' }), 0)
})

test('protein follows lean mass: weight above a body mass index of 30 is not counted', () => {
  const p: Profile = { name: 'T', sex: 'male', age: 40, heightCm: 175, weightKg: 130, targetWeightKg: 100, activity: 'light', goal: 'lose', onboarded: true }
  assert.ok(proteinWeight(p) < 93 && proteinWeight(p) > 91)
  assert.equal(computeTargets(p).protein, Math.round(proteinWeight(p) * 2))
  assert.equal(proteinWeight({ weightKg: 70, heightCm: 175 }), 70)
  assert.equal(computeTargets({ ...p, weightKg: 70, goal: 'maintain' }).protein, 112)
})
