import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { askCoach, coachConfigured, type CoachTopic } from '../../lib/coachApi'
import { uid } from '../../lib/date'
import { thinkingLine } from '../../lib/chat'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { SkyOrb } from '../SkyOrb'
import { Icon, tap } from '../ui'
import { RichText } from './RichText'

const ERROR: Record<string, string> = {
  not_configured: 'Talking to Breeze is not set up in this build.',
  monthly_limit: 'You have used this month’s messages to Breeze.',
  declined: 'I can’t help with that one. If it is about your health, your GP is the right person to ask.',
  offline: 'I can’t reach Breeze. Check your connection and try again.',
  busy: 'Breeze is busy right now. Try again in a moment.',
  failed: 'Something went wrong on my side. Try again.',
}

/**
 * A small chat that belongs to one thing: an exercise, a meal, a recipe. The
 * page above it gives the facts; this is where the person asks Breeze about
 * that one thing without it getting mixed into the day's main chat. Each
 * topic keeps its own conversation, so coming back to the glute bridge shows
 * what was asked about the glute bridge. What Breeze learns here still goes
 * into its memory.
 */
export function TopicChat({ id, topic, ask }: {
  /** where this conversation is kept, e.g. "exercise:glute-bridge" */
  id: string
  topic: CoachTopic
  /** questions offered before anything has been asked */
  ask: string[]
}) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [thought, setThought] = useState('')
  const [error, setError] = useState('')
  const messages = state.topicChats?.[id] ?? []

  const send = async (said: string) => {
    const m = said.trim()
    if (!m || busy) return
    tap()
    setText(''); setError(''); setThought(''); setBusy(true)
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    dispatch({ type: 'topicChat', id, messages: [user] })
    const res = await askCoach(state, [...messages, user], (t) => setThought(thinkingLine(t)), { topic })
    setBusy(false); setThought('')
    if (!res.ok) { setError(ERROR[res.error] ?? ERROR.failed); return }
    if (res.memory.forget.length) dispatch({ type: 'forget', ids: res.memory.forget })
    if (res.memory.remember.length) dispatch({ type: 'remember', texts: res.memory.remember })
    // only the words belong here: plans and cards are made in the main chat
    dispatch({ type: 'topicChat', id, messages: [{ id: res.message.id, role: 'coach', text: res.message.text, noted: res.message.noted }] })
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkyOrb size={34} mode={busy ? 'thinking' : 'idle'} />
        <View style={{ flex: 1 }}>
          <Text style={T.title3}>Ask Breeze</Text>
          <Text style={T.caption} numberOfLines={1}>About {topic.name.toLowerCase()}, and nothing else</Text>
        </View>
        {messages.length > 0 && !busy && (
          <Pressable hitSlop={10} onPress={() => { tap(); dispatch({ type: 'clearTopicChat', id }) }} accessibilityLabel="Clear this conversation"><Icon name="trash-outline" size={18} color={C.text3} /></Pressable>
        )}
      </View>

      {!messages.length && coachConfigured() && (
        <View style={{ gap: 8 }}>
          {ask.map((q) => (
            <Pressable key={q} onPress={() => send(q)} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14 }, pressed && { opacity: 0.6 }]}>
              <Text style={[T.body, { flex: 1, lineHeight: 21 }]}>{q}</Text>
              <Icon name="arrow-up" size={16} color={C.accent} />
            </Pressable>
          ))}
        </View>
      )}

      {messages.map((m) => (m.role === 'user' ? (
        <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '86%', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: C.night }}>
          <Text selectable style={{ fontSize: 16, lineHeight: 23, color: C.cloud }}>{m.text}</Text>
        </View>
      ) : (
        <View key={m.id} style={{ gap: 6 }}>
          <RichText text={m.text} color={C.text} strong={C.night} />
          {!!m.noted?.length && <Text style={[T.caption, { lineHeight: 17 }]}>Noted: {m.noted.join(' ')}</Text>}
        </View>
      )))}
      {busy && <Text accessibilityLabel="Breeze is thinking" style={{ fontSize: 15, lineHeight: 22, color: C.text2 }}>{thought || 'Thinking…'}</Text>}
      {!!error && <Text style={[T.sub, { color: C.red, lineHeight: 19 }]}>{error}</Text>}

      <View style={{ flexDirection: 'row', alignItems: 'center', height: 54, paddingLeft: 16, paddingRight: 6, backgroundColor: '#fff', borderRadius: 27, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder={`Ask about ${topic.name.toLowerCase()}`} placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" submitBehavior="submit" editable={coachConfigured()}
          style={{ flex: 1, fontSize: 17, color: C.text, minHeight: 44 }} />
        {!!text.trim() && (
          <Pressable onPress={() => send(text)} disabled={busy} accessibilityLabel="Send" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: busy ? C.fill2 : C.night, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" size={20} color={C.cloud} />
          </Pressable>
        )}
      </View>
    </View>
  )
}
