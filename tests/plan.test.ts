import test from 'node:test'
import assert from 'node:assert/strict'
import { COMPARE, PLUS, billingLine, isPlus, needsDataChoice, sharesData, tierOf, type Subscription } from '../src/lib/plan'

const plus: Subscription = { tier: 'plus', since: '2026-11-18T12:00:00.000Z', via: 'store' }
const yes = { share: true, at: '2026-11-18T12:00:00.000Z' }
const no = { share: false, at: '2026-11-18T12:00:00.000Z' }

test('everyone is on the free plan until they have Plus', () => {
  assert.equal(tierOf({}), 'free')
  assert.equal(tierOf({ subscription: { ...plus, tier: 'free' } }), 'free')
  assert.equal(tierOf({ subscription: plus }), 'plus')
  assert.ok(isPlus({ subscription: { ...plus, via: 'preview' } }))
})

test('data is shared only by a free user who said yes', () => {
  assert.equal(sharesData({}), false, 'nothing is shared before they are asked')
  assert.equal(sharesData({ dataChoice: no }), false)
  assert.equal(sharesData({ dataChoice: yes }), true)
  // Plus never shares, whatever was chosen while on the free plan
  assert.equal(sharesData({ subscription: plus, dataChoice: yes }), false)
})

test('only a free user who has not answered is still to be asked', () => {
  assert.equal(needsDataChoice({}), true)
  assert.equal(needsDataChoice({ dataChoice: no }), false)
  assert.equal(needsDataChoice({ subscription: plus }), false)
})

test('the billing line says who takes the money, what it is called and how to stop', () => {
  for (const store of ['ios', 'android', 'other'] as const) {
    const line = billingLine(store)
    assert.ok(line.includes(PLUS.billedAs) && /cancel any time/.test(line), line)
  }
  assert.match(billingLine('ios'), /Apple.*App Store/)
  assert.match(billingLine('android'), /Google.*Google Play/)
})

test('the yearly saving quoted matches the two prices', () => {
  const pounds = (s: string) => Number(s.replace('£', ''))
  const saving = Math.round((1 - pounds(PLUS.yearly) / (pounds(PLUS.monthly) * 12)) * 100)
  assert.equal(`${saving}%`, PLUS.yearlySaving)
  assert.ok(COMPARE.length >= 3 && COMPARE.every((r) => r.title && r.free && r.plus))
})
