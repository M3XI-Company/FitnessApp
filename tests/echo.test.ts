import test from 'node:test'
import assert from 'node:assert/strict'
import { isEcho, isInterruption } from '../src/lib/echo'
import { intensityOf } from '../src/lib/intensity'
import { memoryGroup } from '../src/lib/memory'

const line = 'Lunch is lemon garlic chicken today, then upper body at five. Ready when you are.'

test('Breeze hearing itself is not the person cutting in', () => {
  assert.ok(isEcho('lemon garlic chicken today', line))
  assert.ok(isEcho('', line))
  assert.equal(isInterruption('upper body at five', line), false)
  // one stray word is not enough to stop it mid-sentence
  assert.equal(isInterruption('wait', line), false)
})

test('the person talking over Breeze is heard as an interruption', () => {
  assert.ok(isInterruption('hang on I already ate', line))
  assert.ok(isInterruption('no stop', line))
  assert.equal(isEcho('can we swap the chicken for fish', line), false)
})

test('all out steps down to push when Plus has ended', () => {
  assert.equal(intensityOf({}), 'steady')
  assert.equal(intensityOf({ intensity: 'push' }), 'push')
  assert.equal(intensityOf({ intensity: 'all_out' }), 'push')
  assert.equal(intensityOf({ intensity: 'all_out', subscription: { tier: 'plus', since: '2026-11-20T10:00:00.000Z', via: 'store' } }), 'all_out')
})

test('a note is filed under what it is about', () => {
  assert.equal(memoryGroup('They dislike mushrooms and love porridge for breakfast.'), 'food')
  assert.equal(memoryGroup('Their left shoulder aches after bench press.'), 'body')
  assert.equal(memoryGroup('They train at home with dumbbells only.'), 'training')
  assert.equal(memoryGroup('They work nights on Thursdays and want to feel fitter for their wedding.'), 'life')
})
