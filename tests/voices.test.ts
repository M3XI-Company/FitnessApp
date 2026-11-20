import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_VOICE, PHONE_VOICE, VOICES, describeVoice, forSpeech, spokenParts, voiceOf } from '../src/lib/voices'

test('every voice has a name, and the phone voice is always on offer', () => {
  assert.equal(new Set(VOICES.map((v) => v.id)).size, VOICES.length)
  for (const v of VOICES) assert.ok(v.name && v.note, v.id)
  assert.ok(VOICES.some((v) => v.id === PHONE_VOICE))
  assert.equal(describeVoice(voiceOf('bm_george')), 'British · man')
  assert.equal(describeVoice(voiceOf(PHONE_VOICE)), 'On this phone')
})

test('a choice that is missing or unknown falls back to the default voice', () => {
  assert.equal(voiceOf(undefined).id, DEFAULT_VOICE)
  assert.equal(voiceOf('not-a-voice').id, DEFAULT_VOICE)
  assert.equal(voiceOf('af_heart').id, 'af_heart')
})

test('the speech server offers the same natural voices as the app', () => {
  const server = readFileSync('scripts/voice-server.py', 'utf8')
  const listed = /VOICES = \[([^\]]+)\]/.exec(server)![1].split(',').map((s) => s.trim().replace(/'/g, ''))
  assert.deepEqual(listed, VOICES.filter((v) => v.id !== PHONE_VOICE).map((v) => v.id))
})

test('a long reply is cut at the end of a sentence before it is spoken', () => {
  assert.equal(forSpeech('  Eat   now.\nThen rest. '), 'Eat now. Then rest.')
  const long = `${'One short sentence. '.repeat(80)}`
  const said = forSpeech(long, 200)
  assert.ok(said.length <= 200 && said.endsWith('sentence.'), said.slice(-30))
})

test('a reply is spoken a sentence at a time, starting with a short piece', () => {
  const text = 'Yes. Lunch is lemon garlic chicken today, then upper body at five. Ready when you are? Good. Tick it off once you have eaten and tell me how the session went afterwards.'
  const parts = spokenParts(text)
  assert.equal(parts.join(' '), text)
  assert.ok(parts.length >= 2 && parts[0].length <= 90, parts[0])
  // a word on its own is never sent to the voice
  assert.ok(parts.every((p) => p.length >= 25), JSON.stringify(parts))
  assert.deepEqual(spokenParts('Hello there'), ['Hello there'])
})
