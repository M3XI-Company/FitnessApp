import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { SUGGESTIONS, reply } from '../../lib/coach'
import { uid } from '../../lib/date'
import { exerciseById } from '../../data/exercises'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow, G, F } from '../../theme'
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
    setTimeout(() => { dispatch({ type: 'chat', messages: [reply(state, m)] }); setTyping(false) }, 650)
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
        <LinearGradient colors={G.ink} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={26} color={C.goldLight} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.cream, fontSize: 28, fontFamily: F.hand, lineHeight: 30 }}>Your AI Trainer</Text>
            <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>Knows your meals, lifts and goals. Ask for workouts, form tips or what to eat.</Text>
          </View>
        </LinearGradient>

        {state.chat.map((m) => (
          <View key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 8 }}>
            <View style={[{ paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, m.role === 'user' ? { backgroundColor: C.ink, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
              <Text style={{ fontSize: 15, lineHeight: 21, color: m.role === 'user' ? C.cream : C.text }}>{m.text}</Text>
            </View>
            {m.workout && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="barbell" color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>{m.workout.title}</Text><Pill>{`${m.workout.items.length} exercises`}</Pill>
                </View>
                {m.workout.items.map((it) => (
                  <Pressable key={it.exerciseId} onPress={() => router.push(`/exercise/${it.exerciseId}`)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
                    <View style={{ flex: 1 }}><Text style={[T.body, { fontWeight: '600' }]}>{exerciseById(it.exerciseId)?.name}</Text><Text style={T.caption}>{it.sets} sets × {it.reps}</Text></View>
                    <Icon name="chevron-forward" size={16} color={C.text3} />
                  </Pressable>
                ))}
              </Card>
            )}
          </View>
        ))}
        {typing && <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, ...shadow }}><Text style={{ color: C.text3, fontWeight: '800', letterSpacing: 2 }}>•••</Text></View>}

        {state.chat.length === 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={[T.eyebrow, { marginLeft: 4 }]}>Try asking</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => send(s)} style={({ pressed }) => [{ backgroundColor: '#fff', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', ...shadow }, pressed && { opacity: 0.8 }]}>
                <Text style={[T.body, { flex: 1, fontWeight: '600' }]}>{s}</Text><Icon name="arrow-up-circle" size={22} color={C.accent} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: Math.max(12, insets.bottom) + 82, padding: 6, backgroundColor: '#fff', borderRadius: 24, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask your trainer…" placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" style={{ flex: 1, fontSize: 16, paddingHorizontal: 12, color: C.text }} />
        <Pressable onPress={() => send(text)} disabled={!text.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? C.ink : C.fill2, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Send">
          <Icon name="arrow-up" size={20} color={C.goldLight} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

