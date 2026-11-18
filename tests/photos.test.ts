import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { SHOPS, cookingVideoUrl, kitQuery, shopUrl, similarRecipesUrl } from '../src/lib/links'
import { hasPhoto, photoCredits } from '../src/lib/photos'
import { allRecipes } from '../src/lib/recipes'
import PHOTOS from '../src/data/photos.json'

const OPEN_LICENCE = /^(CC0|Public domain|PD|CC BY(-SA)? \d)/i
const photos = PHOTOS as Record<string, { url: string; title: string; by: string; licence: string; page: string }>

test('nearly every meal and ingredient has a photo, and the rest fall back to artwork', () => {
  const recipes = allRecipes()
  const meals = recipes.filter((c) => hasPhoto(c.recipe.id))
  assert.ok(meals.length / recipes.length >= 0.9, `${meals.length} of ${recipes.length} meals have a photo`)
  const foods = new Set(recipes.flatMap((c) => c.ingredients.map((i) => i.food.id)))
  const withPhoto = [...foods].filter(hasPhoto)
  assert.ok(withPhoto.length / foods.size >= 0.95, `${withPhoto.length} of ${foods.size} ingredients have a photo`)
  assert.equal(hasPhoto('cofid-00-000'), false)
})

test('every photo belongs to a recipe or an ingredient in a recipe', () => {
  const recipes = allRecipes()
  const known = new Set([...recipes.map((c) => c.recipe.id), ...recipes.flatMap((c) => c.ingredients.map((i) => i.food.id))])
  for (const key of Object.keys(photos)) assert.ok(known.has(key), `${key} is not used`)
})

test('every photo is openly licensed and credited to its page on Wikimedia Commons', () => {
  for (const [key, p] of Object.entries(photos)) {
    assert.match(p.licence, OPEN_LICENCE, `${key}: ${p.licence}`)
    assert.match(p.url, /^https:\/\/(upload|thumb)\.wikimedia\.org\//, key)
    assert.match(p.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, key)
    assert.ok(p.title, key)
  }
  assert.ok(photoCredits().length > 0)
})

test('every photo listed is in the app, and nothing else is', () => {
  const files = readFileSync('src/data/photoFiles.ts', 'utf8')
  for (const key of Object.keys(photos)) {
    const name = `${key.replace(/-/g, '_')}.jpg`
    assert.ok(existsSync(`assets/photos/${name}`), `${name} is missing from assets/photos`)
    assert.ok(files.includes(`'${key}': require('../../assets/photos/${name}')`), `${key} is missing from photoFiles.ts`)
  }
  assert.equal(files.match(/require\(/g)?.length, Object.keys(photos).length)
})

test('the video link searches for how to make the dish', () => {
  const url = cookingVideoUrl('Lemon garlic chicken, rice & broccoli')
  assert.ok(url.startsWith('https://www.youtube.com/results?search_query='))
  assert.equal(decodeURIComponent(url.split('=')[1]), 'how to make lemon garlic chicken rice broccoli')
})

test('the meal kit link searches for the dish in a few plain words', () => {
  assert.equal(kitQuery('Lean beef chilli with rice'), 'beef chilli rice')
  assert.equal(kitQuery('Protein overnight oats'), 'overnight oats')
  assert.equal(kitQuery('Chicken & houmous wrap'), 'chicken houmous wrap')
  assert.equal(similarRecipesUrl('Roast salmon, sweet potato & green beans'), 'https://www.bbcgoodfood.com/search?q=salmon%20sweet%20potato')
  assert.equal(shopUrl('tesco', 'Semi-skimmed milk'), 'https://www.tesco.com/groceries/en-GB/search?query=semi-skimmed%20milk')
  for (const s of SHOPS) assert.ok(shopUrl(s.id, 'Greek-style yoghurt').startsWith('https://') && shopUrl(s.id, 'Greek-style yoghurt').includes('greek-style%20yoghurt'))
})
