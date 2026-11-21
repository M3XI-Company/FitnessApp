import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Mood } from '../../lib/mood'
import type { ChatMessage } from '../../lib/types'
import { plainText } from '../../lib/chat'
import { canListen, listen, listenOver, pause, speakAs, stopSpeaking, type Listening, type Overhearing } from '../../lib/voice'
import { C, T } from '../../theme'
import { SkyOrb, type OrbMode } from '../SkyOrb'
import { VoiceBar } from '../VoiceBar'
import type { Advisor } from '../../lib/advisors'
import { AdvisorTag } from './AdvisorTag'

type Mode = 'waiting' | 'listening' | 'thinking' | 'speaking'
const ORB: Record<Mode, OrbMode> = { waiting: 'idle', listening: 'listening', thinking: 'thinking', speaking: 'speaking' }

/** The part of a reply that is said out loud: its first paragraph. */
const spoken = (m: ChatMessage) => plainText(m.text).split('\n\n')[0].trim()
/** True when a reply carries something to look at (a plan, a card), which stays in the chat. */
const hasCard = (m: ChatMessage) => !!(m.day || m.guide || m.routine || m.meals || m.workout || m.reminders || m.details)

/**
 * Talking to Breeze: the breeze and nothing else. Breeze listens, shows what it
 * is thinking while it works, says its answer, and listens again. It can be
 * talked over: it stops mid-sentence and takes what was said as the next turn. Everything
 * said is also written into the chat, where any plan or card it made waits.
 */
export function VoiceMode({ onClose, respond, mood, opening }: {
  onClose: () => void
  /** how the chat is going, which sets the look of the orb */
  mood?: Mood
  /** something Breeze says first, before listening: the debrief after a session */
  opening?: string
  /** sends what the user said to the coach and resolves with its reply; `onThinking` gets the live thinking */
  respond: (text: string, onThinking: (thought: string) => void) => Promise<ChatMessage>
}) {
  const insets = useSafeAreaInsets()
  const hears = canListen()
  const [mode, setMode] = useState<Mode>('waiting')
  const [line, setLine] = useState(() => opening ?? (hears ? 'I’m listening.' : 'Type below and I’ll answer out loud.'))
  const [partial, setPartial] = useState('')
  // which coach is speaking
  const [who, setWho] = useState<Advisor | undefined>()
  const [thought, setThought] = useState('')
  const [level, setLevel] = useState(0)
  const [typed, setTyped] = useState('')
  const [card, setCard] = useState(false)
  const open = useRef(true)
  const ear = useRef<Listening | null>(null)
  // the microphone left open while Breeze talks, so the person can cut in
  const over = useRef<Overhearing | null>(null)

  function hear() {
    if (!hears || !open.current) { setMode('waiting'); return }
    setPartial(''); setLevel(0); setMode('listening')
    const l = listen(setPartial, setLevel)
    ear.current = l
    l.result.then((text) => {
      if (!open.current || ear.current !== l) return
      ear.current = null
      if (text) turn(text); else setMode('waiting')
    })
  }

  async function turn(text: string) {
    const said = text.trim()
    if (!said || !open.current) return
    stopSpeaking()
    over.current?.cancel(); over.current = null
    setPartial(said); setTyped(''); setThought(''); setCard(false); setMode('thinking')
    const reply = await respond(said, (t) => { if (open.current) setThought(t) })
    if (!open.current) return
    const say = spoken(reply)
    setLine(say); setCard(hasCard(reply)); setPartial(''); setThought('')
    await sayAloud(say, reply.speaker)
  }

  /**
   * Breeze says a line and listens while it does. Talking over it stops it
   * mid-sentence and what the person says becomes their turn; otherwise it
   * finishes and then listens in the ordinary way.
   */
  async function sayAloud(say: string, by?: Advisor) {
    setWho(by); setMode('speaking')
    const o = listenOver(say, () => { stopSpeaking(); setLevel(0); setMode('listening') }, setPartial, setLevel)
    over.current = o
    await speakAs(say, by)
    if (!open.current || over.current !== o) return
    if (!o.cutIn()) {
      o.cancel(); over.current = null
      await pause(250)
      if (open.current) hear()
      return
    }
    const said = await o.said
    if (!open.current || over.current !== o) return
    over.current = null
    if (said) turn(said); else hear()
  }

  /** Breeze speaks first, then listens. */
  async function begin() {
    if (!opening) { hear(); return }
    await sayAloud(opening)
  }

  // start as soon as the conversation opens, and stop everything when it closes
  useEffect(() => {
    open.current = true
    const t = setTimeout(begin, 0)
    return () => { clearTimeout(t); open.current = false; ear.current?.cancel(); ear.current = null; over.current?.cancel(); over.current = null; stopSpeaking() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { open.current = false; ear.current?.cancel(); ear.current = null; over.current?.cancel(); over.current = null; stopSpeaking(); onClose() }
  const mic = !hears ? 'off' : mode === 'listening' ? 'listening' : mode === 'waiting' ? 'ready' : 'busy'

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F7F8FA', paddingTop: insets.top + 12, paddingBottom: Math.max(16, insets.bottom + 10), paddingHorizontal: 18 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable focusable={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34 }} onPress={mode === 'speaking' ? () => { stopSpeaking() } : undefined}
          accessibilityLabel={mode === 'speaking' ? 'Breeze is speaking. Talk over it or tap to stop it.' : undefined}>
          <SkyOrb size={250} mode={ORB[mode]} level={level} mood={mood} />
          <View style={{ minHeight: 120, maxWidth: 340, gap: 10, alignItems: 'center' }}>
            {mode === 'thinking' ? (
              // Breeze's thinking, shown as it happens
              <Text accessibilityLabel={`Breeze is thinking: ${thought}`} style={[T.sub, { textAlign: 'center', fontStyle: 'italic', lineHeight: 21, color: C.text3 }]} numberOfLines={4}>{thought || 'Thinking…'}</Text>
            ) : mode === 'listening' ? (
              <Text style={[T.body, { textAlign: 'center', fontSize: 18, lineHeight: 25, color: partial ? C.text : C.text3 }]}>{partial || 'Listening…'}</Text>
            ) : (
              <>
                {who && <AdvisorTag who={who} center />}
                <Text style={[T.body, { textAlign: 'center', fontSize: 18, lineHeight: 25, color: C.text }]}>{line}</Text>
                {card && <Text style={[T.caption, { textAlign: 'center' }]}>I’ve put the details in your chat.</Text>}
              </>
            )}
          </View>
        </Pressable>
        <VoiceBar text={typed} onChangeText={setTyped} onSend={() => turn(typed)} placeholder="Ask Breeze" editable={mode !== 'thinking'}
          mic={mic} onMic={() => (mode === 'listening' ? ear.current?.stop() : hear())} onClose={close} />
      </KeyboardAvoidingView>
    </Modal>
  )
}
