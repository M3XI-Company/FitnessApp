/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimsFor, trafficLights, type Composition } from '../src/lib/impact'
import { recipeById } from '../src/lib/recipes'

const base: Composition = { kcal: 400, protein: 10, carbs: 50, fat: 10, fiber: 2, sugar: 4, satFat: 2, salt: 0.5, grams: 400, unknown: [] }
const texts = (c: Composition) => claimsFor(c).map((x) => x.text)

test('protein claims follow the share-of-energy conditions', () => {
  assert.ok(!texts(base).some((t) => /protein/i.test(t)))            // 10%
  assert.ok(texts({ ...base, protein: 12 }).includes('Source of protein')) // 12%
  const high = texts({ ...base, protein: 20 })                       // 20%
  assert.ok(high.includes('High protein') && !high.includes('Source of protein'))
  assert.ok(high.some((t) => /growth in muscle mass/.test(t)))
})

test('claims are withheld when a nutrient is unknown', () => {
  const c = { ...base, fiber: 30, unknown: ['fiber'] as Composition['unknown'] }
  assert.ok(!texts(c).some((t) => /fibre/i.test(t)))
  assert.ok(texts({ ...c, unknown: [] }).includes('High fibre'))
})

test('traffic lights use per-100 g bands and the large-portion rule', () => {
  const l = trafficLights({ ...base, sugar: 4, grams: 400 }).find((x) => x.key === 'sugar')!
  assert.equal(l.level, 'low')                                        // 1 g/100 g
  const big = trafficLights({ ...base, fat: 22, grams: 1000 }).find((x) => x.key === 'fat')!
  assert.equal(big.level, 'high')                                     // 2.2 g/100 g but >21 g per portion
  const unk = trafficLights({ ...base, unknown: ['salt'] }).find((x) => x.key === 'salt')!
  assert.ok(unk.atLeast)
})

test('real recipes get sensible claims', () => {
  const chicken = recipeById('lemon-chicken-rice')!
  assert.ok(texts(chicken.composition).includes('High protein'))
})
