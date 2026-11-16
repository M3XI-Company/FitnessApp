import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { reply } from '../../lib/coach'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { uid } from '../../lib/date'
import { buildRoutine } from '../../lib/routine'
import { useStore } from '../../lib/store'
import type { AppState, ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { Icon, tap } from '../ui'
import { RoutineCard } from '../coach/PlanCard'

const OPENING = 'I have your basics. Before I build your week: how many days can you train, what equipment do you have, and is there anything I should work around?'
const QUICK = ['3 days a week, full gym', '4 days a week, full gym', '3 days, dumbbells at home', 'Bodyweight only, at home']

/**
 * Onboarding chat: the coach asks what it needs, then proposes the first
 * weekly routine as a card the user can accept. The conversation is kept, so
 * it carries on in the Coach tab afterwards. `draft` is the app state with the
 * profile as entered so far (it is not saved until onboarding finishes).
 */
export function CoachIntro({ draft }: { draft: AppState }) {
  const { state, dispatch } = useStore()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  // only this conversation: anything said before onboarding began is not shown here
  const [started] = useState(state.chat.length)
  const chat = state.chat.slice(started)
  const hasRoutine = chat.some((m) => m.routine)

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m || typing) return
    tap()
    const opening: ChatMessage = { id: uid(), role: 'coach', text: OPENING }
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    // the opening question is saved with the first answer, so the transcript reads properly later
    const fresh = chat.length ? [user] : [opening, user]
    dispatch({ type: 'chat', messages: fresh })
    setText('')
    setTyping(true)
    const answer = (message: ChatMessage) => { dispatch({ type: 'chat', messages: [message] }); setTyping(false) }
    // built-in coach: used when the connected coach is not set up or cannot be reached
    const local = () => answer(chat.some((x) => x.routine)
      ? reply(draft, m)
      : { id: uid(), role: 'coach', text: 'Here is a weekly routine built from your goal and activity level. Weights are set for you and go up gradually. You can change any of it later in the Coach tab.', routine: buildRoutine(draft.profile) })
    if (!coachConfigured()) { setTimeout(local, 700); return }
    askCoach(draft, [...chat, ...fresh]).then((res) => {
      if (res.ok) return answer(res.message)
      if (res.error === 'declined') return answer({ id: uid(), role: 'coach', text: 'I can’t help with that one. If it is about your health, your GP is the right person to ask.' })
      local()
    })
  }

  return (
    <View style={{ gap: 12 }}>
      <Text style={T.title1}>Plan your week with the coach</Text>
      <Text style={[T.sub, { marginTop: -6, lineHeight: 20 }]}>Answer in your own words. The coach builds your routine around what you say{draft.bodyScan ? ' and your body scan' : ''}.</Text>

      <Bubble role="coach" text={OPENING} />
      {chat.filter((m, i) => !(i === 0 && m.role === 'coach' && m.text === OPENING)).map((m) => (
        <View key={m.id} style={{ gap: 8 }}>
          <Bubble role={m.role} text={m.text} />
          {m.routine && <RoutineCard routine={m.routine} />}
        </View>
      ))}
      {typing && <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, ...shadow }}><Text style={{ color: C.text3, fontWeight: '800', letterSpacing: 2 }}>•••</Text></View>}

      {!chat.length && !typing && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK.map((q) => (
            <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, backgroundColor: C.accentSoft }, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{q}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, padding: 6, backgroundColor: '#fff', borderRadius: 24, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder={chat.length ? 'Reply to the coach…' : 'Or type your answer…'} placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" editable={!typing}
          style={{ flex: 1, fontSize: 16, paddingHorizontal: 12, color: C.text, minHeight: 40 }} />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || typing} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() && !typing ? C.night : C.fill2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={20} color={C.skyLight} />
        </Pressable>
      </View>
      <Text style={[T.caption, { textAlign: 'center' }]}>
        {hasRoutine ? 'Happy with it? Tap “Use this routine”, then Continue. You can keep adjusting it here.' : coachConfigured() ? 'Replies take 15 to 30 seconds. You can also skip and start with a routine built from your answers.' : 'You can skip and start with a routine built from your answers.'}
      </Text>
    </View>
  )
}

function Bubble({ role, text }: { role: ChatMessage['role']; text: string }) {
  const mine = role === 'user'
  return (
    <View style={[{ maxWidth: '88%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, mine ? { alignSelf: 'flex-end', backgroundColor: C.night, borderBottomRightRadius: 6 } : { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
      <Text style={{ fontSize: 15, lineHeight: 21, color: mine ? C.cloud : C.text }}>{text}</Text>
    </View>
  )
}
