/**
 * The voices Breeze can speak with.
 *
 * The natural ones are Kokoro voices (hexgrad/Kokoro-82M, open weights under
 * the Apache licence). Kokoro is a speech model, so it runs on a server the
 * app is pointed at (scripts/voice-server.py) and the app plays the sound it
 * sends back. "Phone voice" is the phone's own text-to-speech, which needs no
 * server and is what the app falls back to whenever the server cannot be
 * reached.
 */
export interface VoiceOption {
  /** Kokoro's name for the voice, or "phone" */
  id: string
  name: string
  accent: 'British' | 'American' | ''
  kind: 'woman' | 'man' | ''
  /** a few words on how it sounds */
  note: string
}

export const PHONE_VOICE = 'phone'

export const VOICES: VoiceOption[] = [
  { id: 'bf_emma', name: 'Emma', accent: 'British', kind: 'woman', note: 'Clear and warm' },
  { id: 'bf_isabella', name: 'Isabella', accent: 'British', kind: 'woman', note: 'Soft and calm' },
  { id: 'bm_george', name: 'George', accent: 'British', kind: 'man', note: 'Steady and reassuring' },
  { id: 'bm_fable', name: 'Fable', accent: 'British', kind: 'man', note: 'Bright, a storyteller' },
  { id: 'af_heart', name: 'Heart', accent: 'American', kind: 'woman', note: 'The most natural of them all' },
  { id: 'af_bella', name: 'Bella', accent: 'American', kind: 'woman', note: 'Lively and upbeat' },
  { id: 'am_michael', name: 'Michael', accent: 'American', kind: 'man', note: 'Relaxed and friendly' },
  { id: 'am_puck', name: 'Puck', accent: 'American', kind: 'man', note: 'Energetic, a gym voice' },
  { id: PHONE_VOICE, name: 'Phone voice', accent: '', kind: '', note: 'Your phone’s own voice. Works with no connection.' },
]

/** The voice a new user hears. */
export const DEFAULT_VOICE = 'bf_emma'

export const voiceById = (id: string | undefined) => VOICES.find((v) => v.id === id)
/** The chosen voice, or the default when nothing valid has been chosen. */
export const voiceOf = (id: string | undefined) => voiceById(id) ?? voiceById(DEFAULT_VOICE)!
export const describeVoice = (v: VoiceOption) => [v.accent, v.kind].filter(Boolean).join(' · ') || 'On this phone'

/** What a voice says when the user asks to hear it. */
export const VOICE_SAMPLE = 'Hi, I’m Breeze. Lunch is lemon garlic chicken today, then upper body at five. Ready when you are.'

/** Speech is asked for one reply at a time; anything longer than this is cut at a sentence. */
export const MAX_SPOKEN_CHARS = 900

/** A reply cut down to what is worth saying aloud in one go, ending on a whole sentence where it can. */
export function forSpeech(text: string, max = MAX_SPOKEN_CHARS): string {
  const plain = text.replace(/\s+/g, ' ').trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > max * 0.4 ? cut.slice(0, end + 1) : cut
}
