/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allRecipes, fitFor, recipeById, scaledGrams } from '../src/lib/recipes'
import { makeEntry, scaleMacros, sumMacros } from '../src/lib/nutrition'

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`)

test('every recipe resolves all ingredients to UK CoFID foods', () => {
  const all = allRecipes()
  assert.ok(all.length >= 20)
  for (const c of all) assert.equal(c.ingredients.length, c.recipe.ingredients.length)
})

test('nutrition is derived: per serving × servings = sum of ingredients', () => {
  for (const c of allRecipes()) {
    const sum = sumMacros(c.ingredients.map((i) => i.nutrition))
    close(c.perServing.kcal * c.recipe.servings, sum.kcal)
    close(c.perServing.protein * c.recipe.servings, sum.protein)
  }
})

test('Add to diary: 1.5 servings logs exactly 1.5 × the per-serving values', () => {
  const c = recipeById('lemon-chicken-rice')!
  const e = makeEntry(c.asFood, { servings: 1.5 }, { id: 'x', date: '2026-11-13', meal: 'dinner', source: 'search' })
  close(e.kcal, c.perServing.kcal * 1.5)
  close(e.protein, c.perServing.protein * 1.5)
  assert.equal(e.dataSource, 'recipe')
  assert.equal(e.qty, 1.5)
})

test('scaling servings scales every ingredient and the nutrition together', () => {
  const c = recipeById('lean-beef-chilli')!
  const two = scaledGrams(c, 2)
  close(two[0].grams, c.ingredients[0].grams / 2)
  close(sumMacros(two.map((i) => i.nutrition)).kcal, c.perServing.kcal * 2)
})

test('allergens are derived from ingredients without false dairy matches', () => {
  assert.deepEqual(recipeById('banana-pb-toast')!.allergens.includes('Milk'), false)
  assert.ok(recipeById('banana-pb-toast')!.allergens.includes('Peanuts'))
  assert.equal(recipeById('red-lentil-dal')!.allergens.includes('Milk'), false)
  assert.ok(recipeById('red-lentil-dal')!.tags.includes('vegan'))
  assert.ok(recipeById('quark-berry-bowl')!.allergens.includes('Milk'))
  assert.ok(recipeById('garlic-prawn-noodles')!.allergens.includes('Crustaceans'))
  assert.ok(recipeById('chicken-veg-soup')!.allergens.includes('Celery'))
})

test('diet labels: meat and fish recipes are never vegetarian; honey is never vegan', () => {
  for (const id of ['lemon-chicken-rice', 'salmon-sweet-potato', 'garlic-prawn-noodles']) assert.ok(!recipeById(id)!.tags.includes('vegetarian'))
  assert.ok(!recipeById('banana-porridge')!.tags.includes('vegan'))
})

test('derived tags follow their published rules', () => {
  for (const c of allRecipes()) {
    const p = c.perServing
    assert.equal(c.tags.includes('high-protein'), p.protein >= 25 && (p.protein * 4) / p.kcal >= 0.25, c.recipe.id)
    assert.equal(c.tags.includes('quick'), c.minutes <= 15, c.recipe.id)
  }
})

test('fit ranking prefers a protein-rich meal that fits over one that blows the budget', () => {
  const remaining = { kcal: 500, protein: 40, carbs: 60, fat: 15 }
  const soup = fitFor(recipeById('chicken-veg-soup')!.perServing, remaining)
  const big = fitFor(scaleMacros(recipeById('salmon-sweet-potato')!.perServing, 1.5), remaining)
  assert.ok(soup.fits && !big.fits)
  assert.ok(soup.score > big.score)
  assert.ok(soup.reasons.some((r) => /protein/.test(r)))
  assert.ok(big.reasons.some((r) => /over/.test(r)))
})
