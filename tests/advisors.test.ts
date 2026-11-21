import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADVISORS, advisorVoice, isAdvisor, otherAdvisor } from '../src/lib/advisors'
import { toChatMessage } from '../src/lib/coachApi'

test('each coach speaks in a voice of their own, in the accent the person chose', () => {
  assert.equal(advisorVoice('performance', 'bf_emma'), 'bm_george')
  assert.equal(advisorVoice('lifestyle', 'bm_george'), 'bf_emma')
  assert.equal(advisorVoice('performance', 'af_heart'), 'am_michael')
  assert.equal(advisorVoice('lifestyle', 'am_puck'), 'af_heart')
  // nothing chosen yet is the default, which is British
  assert.equal(advisorVoice('lifestyle', undefined), 'bf_emma')
})

test('the phone voice and a reply with no coach keep the chosen voice', () => {
  assert.equal(advisorVoice('performance', 'phone'), undefined)
  assert.equal(advisorVoice(undefined, 'bf_emma'), undefined)
})

test('there are two coaches and each is the other one\'s other', () => {
  assert.equal(otherAdvisor('performance'), 'lifestyle')
  assert.equal(otherAdvisor('lifestyle'), 'performance')
  assert.ok(isAdvisor('lifestyle') && !isAdvisor('coach') && !isAdvisor(undefined))
  assert.notEqual(ADVISORS.performance.name, ADVISORS.lifestyle.name)
})

test('a reply carries who wrote it, and the other coach\'s line only with a known coach', () => {
  const base = { reply: 'Squat first.', update_routine: false, routine_days: [], update_meal_plan: false, meal_days: [] }
  const m = toChatMessage({ ...base, speaker: 'performance', second: '  And eat before it.  ' })
  assert.equal(m.speaker, 'performance')
  assert.equal(m.second, 'And eat before it.')
  const old = toChatMessage({ ...base, second: 'ignored' })
  assert.equal(old.speaker, undefined)
  assert.equal(old.second, undefined)
  assert.equal(toChatMessage({ ...base, speaker: 'someone', second: 'x' }).speaker, undefined)
})
