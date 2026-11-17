import { useEffect, useRef, useState } from 'react'
import { AppState as PhoneState, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { yesterdayLine } from '../../lib/achievements'
import { CHAT_FULL_TEXT, chatFull, chatIsOld, checkinMessage, localAnswer, localIntent, needsCheckin, thinkingLine } from '../../lib/chat'
import { reply } from '../../lib/coach'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { todayKey, uid } from '../../lib/date'
import { chatMood } from '../../lib/mood'
import { easingIn } from '../../lib/progress'
import { syncReminders } from '../../lib/notify'
import { remindersMessage } from '../../lib/reminders'
import { buildRoutine, dayProgress, routineStreak } from '../../lib/routine'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { MealPlanCard, RoutineCard, WorkoutCard } from '../coach/PlanCard'
import { SkyOrb } from '../SkyOrb'
import { Button, Icon, IconButton, tap } from '../ui'
import { DayCard } from './DayCard'
import { DetailsCard } from './DetailsCard'
import { ReminderCard } from './ReminderCard'
import { VoiceMode } from './VoiceMode'
import { WorkoutGuide } from './WorkoutGuide'

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

/** Older messages stay saved; only the recent ones are drawn. */
const SHOWN = 60

/**
 * Breeze is a chat. A new chat is empty apart from a greeting and today's
 * plan as tiles; the coach walks the user through the workout and changes
 * the routine or meals when asked. A chat lasts a day and at most 60 messages;
 * earlier chats are kept in History, and what the user achieved in them is
 * passed to the coach, so nothing is forgotten. Asking for
 * the plan or starting a workout is answered on the phone; everything else
 * goes to the AI coach, with the built-in coach as the fallback.
 */
export function Chat() {
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  // what the coach is working out, shown while it works
  const [thought, setThought] = useState('')
  const [voice, setVoice] = useState(false)
  // the debrief after a session is spoken: the newest check-in opens the voice conversation once, and not again after it is closed or the app restarts
  const checkin = [...state.chat].reverse().find((m) => m.checkin)
  const [heard, setHeard] = useState(() => checkin?.id)
  const debrief = checkin && checkin.id !== heard ? checkin.text : undefined
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const [today, setToday] = useState(todayKey)
  const workout = dayProgress(state, today)
  const mood = chatMood(state.chat)
  const full = chatFull(state)
  const streak = routineStreak(state)

  // keep the phone's reminders in step with the plan, and rebuild them whenever the app comes back to the front
  const latest = useRef(state)
  useEffect(() => { latest.current = state; syncReminders(state) }, [state])
  useEffect(() => {
    const sub = PhoneState.addEventListener('change', (status) => { if (status === 'active') { syncReminders(latest.current); setToday(todayKey()) } })
    return () => sub.remove()
  }, [])
  // a chat lasts a day: yesterday's is put away in History and today starts fresh. What was achieved is not lost, the coach is told it with every message
  useEffect(() => { if (chatIsOld(state, today)) dispatch({ type: 'newChat' }) }, [state, today, dispatch])
  // once the guided workout is finished, ask how it went (the answer is how the coach learns what to change)
  useEffect(() => { if (needsCheckin(state, today)) dispatch({ type: 'chat', messages: [checkinMessage(today, { easing: easingIn(state) })] }) }, [state, today, dispatch])
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(t) }, [state.chat.length, typing, thought])

  /** Send what the user said and resolve with Breeze's reply; used by typing and by voice. */
  const respond = (m: string, onThinking?: (thought: string) => void) => new Promise<ChatMessage>((resolve) => {
    // a full chat takes no more: said out loud in voice mode, and shown in place of the message box
    if (full) { resolve({ id: uid(), role: 'coach', text: CHAT_FULL_TEXT }); return }
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    const intent = localIntent(m)
    if (intent) {
      const a = intent === 'reminders' ? remindersMessage(state) : localAnswer(state, intent, today)
      dispatch({ type: 'chat', messages: [user, a] }); resolve(a); return
    }
    dispatch({ type: 'chat', messages: [user] })
    setTyping(true); setThought('')
    const answer = (message: ChatMessage) => { dispatch({ type: 'chat', messages: [message] }); setTyping(false); resolve(message) }
    // built-in coach: rule-based, used when the AI coach is not set up or cannot be reached
    const local = (notice?: string) => {
      const q = m.toLowerCase()
      const wantsRoutine = /\b(routine|plan|programme|program|schedule|week)\b/.test(q) && !/\b(meal|meals|food|eat|diet|dinner|lunch|breakfast)\b/.test(q)
      const message: ChatMessage = wantsRoutine
        ? { id: uid(), role: 'coach', text: 'Here is a weekly routine built from your goal and activity level. Weights are set for you from your own sessions and go up gradually.', routine: buildRoutine(state.profile) }
        : reply(state, m)
      answer(notice ? { ...message, text: `${notice}\n\n${message.text}` } : message)
    }
    if (!coachConfigured()) { setTimeout(() => local(), 500); return }
    askCoach(state, [...state.chat, user], (thinking) => { const l = thinkingLine(thinking); setThought(l); onThinking?.(l) }).then((res) => {
      if (res.ok) {
        // the coach's memory is updated straight away; what it noted is shown under the reply
        if (res.memory.forget.length) dispatch({ type: 'forget', ids: res.memory.forget })
        if (res.memory.remember.length) dispatch({ type: 'remember', texts: res.memory.remember })
        return answer(res.message)
      }
      if (res.error === 'declined') return answer({ id: uid(), role: 'coach', text: 'I can\u2019t help with that one. If it is about your health, your GP is the right person to ask.' })
      local(res.error === 'monthly_limit' ? 'You have used this month\u2019s AI coach messages, so this answer comes from the built-in coach.' : 'I couldn\u2019t reach the AI coach just now, so this answer comes from the built-in coach.')
    })
  })

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m || typing) return
    tap()
    setText('')
    respond(m)
  }

  const shown = state.chat.slice(-SHOWN)
  const liveGuide = [...shown].reverse().find((m) => m.guide)?.id
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 10 }}>
        <IconButton icon="menu" size={44} onPress={() => router.push('/history')} label="Chats" />
        <View style={{ flex: 1, alignItems: 'center' }}>
          {/* Breeze stays in view through the chat, its mood following the conversation */}
          {shown.length > 0 && (
            <Pressable onPress={() => { tap(); setVoice(true) }} accessibilityLabel="Talk to Breeze" hitSlop={6}>
              <SkyOrb size={44} mode={typing ? 'thinking' : 'idle'} mood={mood} />
            </Pressable>
          )}
        </View>
        {shown.length > 0 && <IconButton icon="create-outline" size={44} onPress={() => { tap(); dispatch({ type: 'newChat' }) }} label="New chat" />}
        <IconButton icon="sliders" size={44} onPress={() => router.push('/settings')} label="Settings" />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* a new chat is empty: a greeting and today at a glance, nothing posted */}
        {!shown.length && (
          <View style={{ flex: 1, justifyContent: 'center', gap: 26, paddingBottom: 20 }}>
            <Pressable onPress={() => { tap(); setVoice(true) }} accessibilityLabel="Talk to Breeze" style={{ alignItems: 'center', gap: 18 }}>
              <SkyOrb size={200} mood={mood} />
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={[T.title2, { textAlign: 'center' }]}>{greeting()}{state.profile.name ? `, ${state.profile.name.split(' ')[0]}` : ''}</Text>
                {!!yesterdayLine(state, today) && <Text style={[T.sub, { textAlign: 'center', color: C.text }]}>{yesterdayLine(state, today)}</Text>}
                <Text style={[T.sub, { textAlign: 'center' }]}>{streak > 1 ? `${streak} days in a row. ` : ''}Tap the breeze to talk, or type below.</Text>
              </View>
            </Pressable>
            <DayCard date={today} onStart={() => send(workout.status === 'started' ? 'Continue my workout' : 'Start my workout')} onAsk={send} />
          </View>
        )}
        {shown.map((m) => {
          const mine = m.role === 'user'
          const wide = !!(m.day || m.guide || m.routine || m.meals || m.workout || m.reminders || m.details)
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : wide ? 'stretch' : 'flex-start', maxWidth: wide ? '100%' : '86%', gap: 8 }}>
              {!!m.text && (
                <View style={[{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: wide ? '86%' : '100%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, mine ? { backgroundColor: C.night, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
                  <Text selectable style={{ fontSize: 15, lineHeight: 21, color: mine ? C.cloud : C.text }}>{m.text}</Text>
                </View>
              )}
              {!!m.noted?.length && (
                <Pressable onPress={() => { tap(); router.push('/memory') }} accessibilityLabel={`Noted: ${m.noted.join('. ')}. Open what Breeze remembers.`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 6, maxWidth: '86%' }}>
                  <Icon name="bookmark-outline" size={14} color={C.text3} />
                  <Text style={[T.caption, { flex: 1, lineHeight: 17 }]}>Noted: {m.noted.join(' ')}</Text>
                </Pressable>
              )}
              {m.details && <DetailsCard change={m.details} />}
              {m.day && <DayCard date={m.day} onStart={() => send(workout.status === 'started' ? 'Continue my workout' : 'Start my workout')} onAsk={send} />}
              {m.guide && <WorkoutGuide date={m.guide} active={m.id === liveGuide} />}
              {m.workout && <WorkoutCard workout={m.workout} />}
              {m.routine && <RoutineCard routine={m.routine} />}
              {m.meals && <MealPlanCard meals={m.meals} />}
              {m.reminders && <ReminderCard suggested={m.reminders} />}
            </View>
          )
        })}
        {typing && (
          <View accessibilityLabel={thought ? `Breeze is thinking: ${thought}` : 'Breeze is thinking'} style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 15, gap: 4, ...shadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkles" size={13} color={C.accent} />
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 }}>THINKING</Text>
              <Text style={{ color: C.text3, fontWeight: '800', letterSpacing: 2 }}>•••</Text>
            </View>
            {!!thought && <Text style={{ fontSize: 14, lineHeight: 19, color: C.text2, fontStyle: 'italic' }}>{thought}</Text>}
          </View>
        )}
      </ScrollView>

      {full ? (
        <View style={{ gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: Math.max(12, insets.bottom + 8) }}>
          <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>{CHAT_FULL_TEXT}</Text>
          <Button title="Start a new chat" icon="create-outline" variant="dark" onPress={() => dispatch({ type: 'newChat' })} />
        </View>
      ) : (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: Math.max(12, insets.bottom + 8) }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: 6, paddingRight: 6, backgroundColor: '#fff', borderRadius: 28, ...shadow }}>
          <Pressable onPress={() => { tap(); router.push('/quick-add') }} accessibilityLabel="Log food, water or weight" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size={24} color={C.night} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="Ask Breeze" placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" submitBehavior="submit"
            style={{ flex: 1, fontSize: 17, paddingHorizontal: 4, color: C.text, minHeight: 44 }} />
          {!!text.trim() && (
            <Pressable onPress={() => send(text)} disabled={typing} accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: typing ? C.fill2 : C.night, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow-up" size={20} color={C.cloud} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => { tap(); setVoice(true) }} accessibilityLabel="Talk to Breeze" style={({ pressed }) => [{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
          <Icon name="voice" size={24} color="#fff" />
        </Pressable>
      </View>
      )}
      {(voice || !!debrief) && <VoiceMode onClose={() => { setVoice(false); setHeard(checkin?.id) }} respond={respond} mood={mood} opening={debrief} />}
    </KeyboardAvoidingView>
  )
}
