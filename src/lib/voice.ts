/**
 * Talking and listening for the spoken onboarding.
 *
 * Speaking uses the phone's own text-to-speech (expo-speech) and works
 * everywhere, including Expo Go. It picks the most natural voice the phone
 * has installed (an enhanced British English one where there is one). Listening uses the phone's speech recogniser
 * (expo-speech-recognition), which is native code that only exists in a
 * development or release build: where it is missing, `canListen()` is false
 * and the screen falls back to typed answers.
 */
import { Platform } from 'react-native'
import * as Speech from 'expo-speech'

type Recognition = typeof import('expo-speech-recognition')

let recognition: Recognition | null = null
try {
  // the module throws on import when its native half is not in the build (Expo Go)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  recognition = require('expo-speech-recognition') as Recognition
} catch {
  recognition = null
}

const LANG = 'en-GB'

/** True when this build and phone can turn speech into text. */
export function canListen(): boolean {
  try {
    return !!recognition && recognition.ExpoSpeechRecognitionModule.isRecognitionAvailable()
  } catch {
    return false
  }
}

/**
 * The best voice installed for speaking English: enhanced before standard,
 * British before other English, and on Android the higher-quality voices
 * that are stored on the phone before the basic ones. Looked up once.
 */
let chosen: Promise<string | undefined> | undefined
function bestVoice(): Promise<string | undefined> {
  chosen ??= Speech.getAvailableVoicesAsync()
    .then((voices) => {
      const score = (v: Speech.Voice) =>
        (v.quality === Speech.VoiceQuality.Enhanced ? 4 : 0) +
        (/^en[-_]GB/i.test(v.language) ? 3 : /^en/i.test(v.language) ? 1 : -100) +
        // Android names its better offline voices "...-local"; "...-network" ones stall without a connection
        (/-local$/i.test(v.identifier) ? 1 : 0)
      const best = voices.filter((v) => /^en/i.test(v.language)).sort((a, b) => score(b) - score(a))[0]
      return best?.identifier
    })
    .catch(() => undefined)
  return chosen
}

/** Say something aloud. Resolves when it has finished, was stopped, or could not be said. */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim()) { resolve(); return }
    // never leave the conversation waiting on a callback that does not come
    const giveUp = setTimeout(resolve, Math.min(60000, 4000 + text.length * 110))
    const done = () => { clearTimeout(giveUp); resolve() }
    bestVoice().then((voice) => {
      try {
        // a touch slower than the default reads as a person talking rather than a machine reading
        Speech.speak(text, { language: LANG, ...(voice ? { voice } : {}), rate: Platform.OS === 'ios' ? 0.5 : 0.94, pitch: 1, onDone: done, onStopped: done, onError: done })
      } catch {
        done()
      }
    })
  })
}

export const stopSpeaking = () => { Speech.stop().catch(() => {}) }

export interface Listening {
  /** finish now and use what has been heard so far */
  stop: () => void
  /** give up without a result */
  cancel: () => void
  /** what was said, or null when nothing was heard or listening is not possible */
  result: Promise<string | null>
}

/**
 * Listen for one answer. `onPartial` gets the words as they are recognised and
 * `onLevel` the microphone level from 0 to 1, for the animation.
 */
export function listen(onPartial: (text: string) => void, onLevel?: (level: number) => void): Listening {
  const sr = recognition?.ExpoSpeechRecognitionModule
  if (!sr || !canListen()) return { stop: () => {}, cancel: () => {}, result: Promise.resolve(null) }
  let heard = ''
  let cancelled = false
  let settle: (v: string | null) => void = () => {}
  const result = new Promise<string | null>((resolve) => { settle = resolve })
  const subs = [
    sr.addListener('result', (e) => { heard = e.results[0]?.transcript ?? heard; onPartial(heard) }),
    sr.addListener('volumechange', (e) => onLevel?.(Math.max(0, Math.min(1, e.value / 10)))),
    sr.addListener('error', () => finish()),
    sr.addListener('end', () => finish()),
  ]
  function finish() {
    subs.forEach((s) => s.remove())
    settle(cancelled ? null : heard.trim() || null)
  }
  sr.requestPermissionsAsync()
    .then((perm) => {
      if (!perm.granted || cancelled) { finish(); return }
      sr.start({
        lang: LANG, interimResults: true, continuous: false, maxAlternatives: 1,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
        // people pause while they think about an answer: do not cut them off after a second
        androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2200 },
      })
    })
    .catch(() => finish())
  return {
    stop: () => { try { sr.stop() } catch { finish() } },
    cancel: () => { cancelled = true; try { sr.abort() } catch { /* already stopped */ } finish() },
    result,
  }
}
