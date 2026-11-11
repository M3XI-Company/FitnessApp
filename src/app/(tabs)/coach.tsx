import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { SUGGESTIONS, reply } from '../../lib/coach'
import { uid } from '../../lib/date'
import { exerciseById } from '../../data/exercises'
import { BUDDIES, type Buddy } from '../../data/buddies'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { Button, Card, Chips, Icon, Pill, Screen, Segmented, tap } from '../../components/ui'

export default function Coach() {
  const [picked, setTab] = useState<'trainer' | 'buddy'>('trainer')
  const { q } = useLocalSearchParams<{ q?: string }>()
  // A question sent from elsewhere (e.g. Train → AI workout) always opens the trainer
  const tab = q ? 'trainer' : picked
  return (
    <Screen title="Coach" scroll={false}>
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'trainer', label: 'AI Trainer' }, { value: 'buddy', label: 'Find a Buddy' }]} />
      </View>
      {tab === 'trainer' ? <Trainer /> : <BuddyFinder />}
    </Screen>
  )
}

function Trainer() {
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
        <LinearGradient colors={['#2A86FF', '#0047CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={26} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Your AI Trainer</Text>
            <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>Knows your meals, lifts and goals. Ask for workouts, form tips or what to eat.</Text>
          </View>
        </LinearGradient>

        {state.chat.map((m) => (
          <View key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 8 }}>
            <View style={[{ paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, m.role === 'user' ? { backgroundColor: C.blue, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
              <Text style={{ fontSize: 15, lineHeight: 21, color: m.role === 'user' ? '#fff' : C.text }}>{m.text}</Text>
            </View>
            {m.workout && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="barbell" color={C.blue} /><Text style={[T.headline, { flex: 1 }]}>{m.workout.title}</Text><Pill>{`${m.workout.items.length} exercises`}</Pill>
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
                <Text style={[T.body, { flex: 1, fontWeight: '600' }]}>{s}</Text><Icon name="arrow-up-circle" size={22} color={C.blue} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12, marginBottom: Math.max(12, insets.bottom) + 82, padding: 6, backgroundColor: '#fff', borderRadius: 24, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask your trainer…" placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" style={{ flex: 1, fontSize: 16, paddingHorizontal: 12, color: C.text }} />
        <Pressable onPress={() => send(text)} disabled={!text.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? C.blue : C.fill2, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Send">
          <Icon name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

type GoalF = Buddy['goal'] | 'Any'
type LevelF = Buddy['level'] | 'Any'
type TimeF = Buddy['times'][number] | 'Any'

function BuddyFinder() {
  const { state, dispatch } = useStore()
  const myGoal: Buddy['goal'] = state.profile.goal === 'lose' ? 'Lose fat' : state.profile.goal === 'gain' ? 'Build muscle' : 'Get fit'
  const myLevel: Buddy['level'] = state.sets.length > 150 ? 'Advanced' : state.sets.length > 30 ? 'Intermediate' : 'Beginner'
  const [goal, setGoal] = useState<GoalF>('Any')
  const [level, setLevel] = useState<LevelF>('Any')
  const [time, setTime] = useState<TimeF>('Any')
  const [km, setKm] = useState<'1' | '3' | '5'>('5')

  const match = (b: Buddy) => {
    let s = 50
    if (b.goal === myGoal) s += 25
    if (b.level === myLevel) s += 15
    s += Math.max(0, 10 - b.km * 2)
    return Math.min(99, Math.round(s))
  }
  const list = BUDDIES
    .filter((b) => (goal === 'Any' || b.goal === goal) && (level === 'Any' || b.level === level) && (time === 'Any' || b.times.includes(time)) && b.km <= +km)
    .sort((a, b) => match(b) - match(a))

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130, gap: 10 }}>
      <Text style={[T.sub, { marginLeft: 4 }]}>Matched to you: {myGoal} · {myLevel}</Text>
      <Chips value={goal} onChange={setGoal} items={(['Any', 'Lose fat', 'Build muscle', 'Get fit', 'Run'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any goal' : v }))} />
      <Chips value={level} onChange={setLevel} items={(['Any', 'Beginner', 'Intermediate', 'Advanced'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any level' : v }))} />
      <Chips value={time} onChange={setTime} items={(['Any', 'Morning', 'Lunch', 'Evening'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any time' : v }))} />
      <Segmented value={km} onChange={setKm} options={[{ value: '1', label: '< 1 km' }, { value: '3', label: '< 3 km' }, { value: '5', label: '< 5 km' }]} />
      <Text style={[T.sub, { marginLeft: 4, marginTop: 4 }]}>{list.length} buddies nearby</Text>
      {list.map((b) => {
        const connected = state.buddies.includes(b.id)
        const m = match(b)
        return (
          <Card key={b.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.blue50, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28 }}>{b.avatar}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={T.title3}>{b.name}, {b.age}</Text>
                <Text style={T.sub}>{b.gym} · {b.km} km</Text>
              </View>
              <View style={{ alignItems: 'center' }}><Text style={[T.title3, { color: m >= 80 ? C.blue : C.text2 }]}>{m}%</Text><Text style={T.caption}>match</Text></View>
            </View>
            <Text style={T.body}>{b.bio}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill>{b.goal}</Pill><Pill color={C.text2} bg={C.fill}>{b.level}</Pill>
              {b.times.map((t) => <Pill key={t} color={C.text2} bg={C.fill}>{t}</Pill>)}
              <Pill color="#B45309" bg="#FFF4E0">{`🔥 ${b.streak} days`}</Pill>
            </View>
            <Button small title={connected ? 'Connected' : 'Connect'} icon={connected ? 'checkmark' : 'person-add'} variant={connected ? 'tinted' : 'primary'} onPress={() => dispatch({ type: 'toggleBuddy', id: b.id })} />
          </Card>
        )
      })}
      {!list.length && <Card><Text style={[T.sub, { textAlign: 'center' }]}>No buddies match these filters. Try widening the distance.</Text></Card>}
    </ScrollView>
  )
}
