import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { briefing, localAnswer, localIntent, needsBriefing } from '../../lib/chat'
import { reply } from '../../lib/coach'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { todayKey, uid } from '../../lib/date'
import { buildRoutine, dayProgress, routineStreak } from '../../lib/routine'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { MealPlanCard, RoutineCard, WorkoutCard } from '../coach/PlanCard'
import { Icon, IconButton, tap } from '../ui'
import { DayCard } from './DayCard'
import { WorkoutGuide } from './WorkoutGuide'

/** Older messages stay saved; only the recent ones are drawn. */
const SHOWN = 60

/**
 * Breeze is one conversation. The coach posts each day's plan, walks the user
 * through the workout and changes the routine or meals when asked. Asking for
 * the plan or starting a workout is answered on the phone; everything else
 * goes to the AI coach, with the built-in coach as the fallback.
 */
export function Chat() {
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const today = todayKey()
  const workout = dayProgress(state, today)
  const streak = routineStreak(state)

  // the first message of each day is the plan for that day
  useEffect(() => {
    if (needsBriefing(state.chat, today)) dispatch({ type: 'chat', messages: [briefing(state, today)] })
  }, [today, state, dispatch])
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(t) }, [state.chat.length, typing])

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m || typing) return
    tap()
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    setText('')
    const intent = localIntent(m)
    if (intent) { dispatch({ type: 'chat', messages: [user, localAnswer(state, intent, today)] }); return }
    dispatch({ type: 'chat', messages: [user] })
    setTyping(true)
    const answer = (message: ChatMessage) => { dispatch({ type: 'chat', messages: [message] }); setTyping(false) }
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
    askCoach(state, [...state.chat, user]).then((res) => {
      if (res.ok) return answer(res.message)
      if (res.error === 'declined') return answer({ id: uid(), role: 'coach', text: 'I can’t help with that one. If it is about your health, your GP is the right person to ask.' })
      local(res.error === 'monthly_limit' ? 'You have used this month’s AI coach messages, so this answer comes from the built-in coach.' : 'I couldn’t reach the AI coach just now, so this answer comes from the built-in coach.')
    })
  }

  const shown = state.chat.slice(-SHOWN)
  const liveGuide = [...shown].reverse().find((m) => m.guide)?.id
  const quick = [
    workout.status === 'todo' ? 'Start my workout' : workout.status === 'started' ? 'Continue my workout' : null,
    'Tomorrow',
    'Change my meals',
    'Can I do more next week?',
  ].filter((x): x is string => !!x)

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 10 }}>
        <Text style={[T.title2, { flex: 1 }]}>Breeze</Text>
        <View accessibilityLabel={`Streak: ${streak} day${streak === 1 ? '' : 's'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 36, borderRadius: 18, backgroundColor: C.card }}>
          <Icon name="flame" size={17} color={streak > 0 ? '#F2622E' : C.text3} />
          <Text style={[T.headline, T.num, { color: streak > 0 ? C.text : C.text3 }]}>{streak}</Text>
        </View>
        <IconButton icon="settings-outline" size={36} onPress={() => router.push('/settings')} label="Settings" />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 10 }} keyboardShouldPersistTaps="handled">
        {shown.map((m) => {
          const mine = m.role === 'user'
          const wide = !!(m.day || m.guide || m.routine || m.meals || m.workout)
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : wide ? 'stretch' : 'flex-start', maxWidth: wide ? '100%' : '86%', gap: 8 }}>
              {!!m.text && (
                <View style={[{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: wide ? '86%' : '100%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, mine ? { backgroundColor: C.night, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
                  <Text selectable style={{ fontSize: 15, lineHeight: 21, color: mine ? C.cloud : C.text }}>{m.text}</Text>
                </View>
              )}
              {m.day && <DayCard date={m.day} onStart={() => send(workout.status === 'started' ? 'Continue my workout' : 'Start my workout')} onAsk={send} />}
              {m.guide && <WorkoutGuide date={m.guide} active={m.id === liveGuide} />}
              {m.workout && <WorkoutCard workout={m.workout} />}
              {m.routine && <RoutineCard routine={m.routine} />}
              {m.meals && <MealPlanCard meals={m.meals} />}
            </View>
          )
        })}
        {typing && <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, ...shadow }}><Text style={{ color: C.text3, fontWeight: '800', letterSpacing: 2 }}>•••</Text></View>}
      </ScrollView>

      <View style={{ paddingBottom: Math.max(10, insets.bottom + 6), gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: 14 }}>
          {quick.map((q) => (
            <Pressable key={q} onPress={() => send(q)} disabled={typing} style={({ pressed }) => [{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: C.card }, (pressed || typing) && { opacity: 0.6 }]}>
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, padding: 6, backgroundColor: '#fff', borderRadius: 26, ...shadow }}>
          <Pressable onPress={() => { tap(); router.push('/quick-add') }} accessibilityLabel="Log food, water or weight" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="add" size={22} color={C.accent} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="Message Breeze" placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" submitBehavior="submit"
            style={{ flex: 1, fontSize: 16, paddingHorizontal: 8, color: C.text, minHeight: 40 }} />
          <Pressable onPress={() => send(text)} disabled={!text.trim() || typing} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() && !typing ? C.night : C.fill2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" size={20} color={C.skyLight} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
