import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { reply } from '../../lib/coach'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { buildRoutine } from '../../lib/routine'
import { MealPlanCard, RoutineCard } from './PlanCard'
import { todayKey, uid } from '../../lib/date'
import { exerciseById } from '../../data/exercises'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow, G } from '../../theme'
import { Card, Icon, Pill, tap } from '../ui'

/** On-device AI trainer chat (rule-based; reads the user's own logs) */
export function AITrainer() {
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const { q } = useLocalSearchParams<{ q?: string }>()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m) return
    tap()
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    dispatch({ type: 'chat', messages: [user] })
    setText('')
    setTyping(true)
    const answer = (message: ChatMessage) => { dispatch({ type: 'chat', messages: [message] }); setTyping(false) }
    // on-device coach: rule-based, used when the connected coach is not set up or cannot be reached
    const local = (notice?: string) => {
      const wantsPlan = /\b(routine|plan|programme|program|schedule|week)\b/.test(m.toLowerCase()) && !/\b(meal|food|eat|diet)\b/.test(m.toLowerCase())
      const message: ChatMessage = wantsPlan
        ? { id: uid(), role: 'coach', text: 'Here is a weekly routine built from your goal and activity level. Weights are set for you from your own sessions and go up gradually.', routine: buildRoutine(state.profile) }
        : reply(state, m)
      answer(notice ? { ...message, text: `${notice}\n\n${message.text}` } : message)
    }
    if (!coachConfigured()) { setTimeout(() => local(), 650); return }
    askCoach(state, [...state.chat, user]).then((res) => {
      if (res.ok) return answer(res.message)
      if (res.error === 'declined') return answer({ id: uid(), role: 'coach', text: 'I can\u2019t help with that one. If it is about your health, your GP is the right person to ask.' })
      local(res.error === 'monthly_limit' ? 'You have used this month\u2019s AI coach messages, so this answer comes from the built-in coach.' : 'I couldn\u2019t reach the AI coach just now, so this answer comes from the built-in coach.')
    })
  }

  useEffect(() => {
    if (!q) return
    const t = setTimeout(() => { send(q); router.setParams({ q: undefined }) }, 0)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50) }, [state.chat.length, typing])

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={G.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={26} color={C.skyLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.cloud, fontSize: 20, fontWeight: '800', lineHeight: 23 }}>Your AI Trainer</Text>
            <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>{coachConfigured() ? 'Knows your goal, routine and targets. Ask it to build or change your weekly routine and meal plan.' : 'Built-in coach. Ask for a routine, a workout, form tips or what to eat.'}</Text>
          </View>
        </LinearGradient>

        {state.chat.map((m) => (
          <View key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 8 }}>
            <View style={[{ paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, m.role === 'user' ? { backgroundColor: C.night, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
              <Text style={{ fontSize: 15, lineHeight: 21, color: m.role === 'user' ? C.cloud : C.text }}>{m.text}</Text>
            </View>
            {m.workout && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="barbell" color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>{m.workout.title}</Text><Pill>{`${m.workout.items.length} exercises`}</Pill>
                </View>
                {m.workout.items.map((it) => {
                  // checklist: an exercise is ticked once today's logged sets reach the advised number
                  const doneSets = state.sets.filter((x) => x.exerciseId === it.exerciseId && x.date === todayKey()).length
                  const done = doneSets >= it.sets
                  return (
                  <Pressable key={it.exerciseId} accessibilityLabel={`${exerciseById(it.exerciseId)?.name}, ${done ? 'done' : `${doneSets} of ${it.sets} sets done`}`} onPress={() => router.push(`/exercise/${it.exerciseId}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
                    <Icon name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? C.accent : C.text3} />
                    <View style={{ flex: 1 }}><Text style={[T.body, { fontWeight: '600', color: done ? C.text3 : C.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{exerciseById(it.exerciseId)?.name}</Text><Text style={T.caption}>{it.sets} sets × {it.reps}{doneSets ? ` · ${Math.min(doneSets, it.sets)} of ${it.sets} done` : ''}</Text></View>
                    <Icon name="chevron-forward" size={16} color={C.text3} />
                  </Pressable>
                  )
                })}
              </Card>
            )}
            {m.routine && <RoutineCard routine={m.routine} />}
            {m.meals && <MealPlanCard meals={m.meals} />}
          </View>
        ))}
        {typing && <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, ...shadow }}><Text style={{ color: C.text3, fontWeight: '800', letterSpacing: 2 }}>•••</Text></View>}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: Math.max(12, insets.bottom) + 82, padding: 6, backgroundColor: '#fff', borderRadius: 24, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask your trainer…" placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" style={{ flex: 1, fontSize: 16, paddingHorizontal: 12, color: C.text }} />
        <Pressable onPress={() => send(text)} disabled={!text.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? C.night : C.fill2, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Send">
          <Icon name="arrow-up" size={20} color={C.skyLight} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

