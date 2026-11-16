import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { eatenOn, mealPlanText, mealsFor, thinkingLine } from '../../lib/chat'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { prettyDate, todayKey, uid } from '../../lib/date'
import { makeEntry } from '../../lib/nutrition'
import { recipeById } from '../../lib/recipes'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { MealPlanCard } from '../../components/coach/PlanCard'
import { CopyButton } from '../../components/chat/DayCard'
import { RecipeCover } from '../../components/RecipeCover'
import { Button, Icon, IconButton, success, tap } from '../../components/ui'

const SUGGESTIONS = ['Something different', 'Make it quicker', 'A vegetarian version', 'Can I prep it ahead?']

/**
 * A short conversation about one meal in the plan: what it is in a line,
 * the two things people do most (cook it, tick it off), and the coach for
 * everything else (swap it, change it, use what is in the fridge). The full
 * recipe is one tap away instead of being the first thing on screen.
 */
export default function MealChat() {
  const { id, date: dateParam, slot } = useLocalSearchParams<{ id: string; date?: string; slot?: string }>()
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const c = recipeById(id)
  const date = dateParam ?? todayKey()
  const portion = mealsFor(state, date).portion
  const meal = slot && slot !== 'snack' ? slot : 'meal'
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [thought, setThought] = useState('')
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(t) }, [msgs.length, busy, thought])
  if (!c) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={T.title2}>Meal not found</Text></View>

  const kcal = Math.round(c.perServing.kcal * portion)
  const protein = Math.round(c.perServing.protein * portion)
  const eaten = eatenOn(state, date, c)
  const isToday = date === todayKey()
  const opening = `${c.recipe.description} ${portion === 1 ? 'One serving' : `${portion} servings`} is ${kcal} kcal and ${protein} g protein, about ${c.minutes} minutes to make. Want to swap it or change it?`

  const send = (msg: string) => {
    const m = msg.trim()
    if (!m || busy) return
    tap()
    const user: ChatMessage = { id: uid(), role: 'user', text: m }
    const shown = [...msgs, user]
    setMsgs(shown); setText(''); setBusy(true); setThought('')
    // the coach is told which meal this conversation is about
    const about: ChatMessage = { id: 'about', role: 'user', text: `This is about my ${meal} on ${prettyDate(date)}: ${c.recipe.title} (recipe id ${c.recipe.id}). If you suggest a change, propose a meal plan for that day that keeps my other meals.` }
    const reply = (message: ChatMessage) => { setMsgs((x) => [...x, message]); setBusy(false); setThought('') }
    if (!coachConfigured()) { reply({ id: uid(), role: 'coach', text: 'The coach isn’t connected in this build, so I can’t change meals from here. You can still cook it or tick it off.' }); return }
    askCoach(state, [about, { id: 'opening', role: 'coach', text: opening }, ...shown], (t) => setThought(thinkingLine(t))).then((res) => {
      if (!res.ok) return reply({ id: uid(), role: 'coach', text: res.error === 'declined' ? 'I can’t help with that one.' : 'I couldn’t reach the coach just now. Try again in a moment.' })
      if (res.memory.forget.length) dispatch({ type: 'forget', ids: res.memory.forget })
      if (res.memory.remember.length) dispatch({ type: 'remember', texts: res.memory.remember })
      reply(res.message)
    })
  }

  const toggleEaten = () => {
    const ids = state.food.filter((f) => f.date === date && f.dataSource === 'recipe' && f.name === c.recipe.title).map((f) => f.id)
    if (ids.length) { tap(); ids.forEach((x) => dispatch({ type: 'removeFood', id: x })); return }
    dispatch({ type: 'addFood', entry: makeEntry(c.asFood, { servings: portion }, { id: uid(), date, meal: slot ?? 'snack', source: 'search', dataSource: 'recipe' }) })
    success()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ paddingTop: Math.max(20, insets.top + 10), paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <RecipeCover c={c} size="thumb" style={{ width: 52, height: 52, borderRadius: 16, padding: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline} numberOfLines={1}>{c.recipe.title}</Text>
          <Text style={[T.caption, T.num]}>{meal === 'meal' ? '' : `${meal[0].toUpperCase()}${meal.slice(1)} · `}{kcal} kcal · {protein} g protein</Text>
        </View>
        <IconButton icon="close" variant="fill" size={36} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Close" />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 10 }} keyboardShouldPersistTaps="handled">
        <Bubble role="coach" text={opening} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small icon="book-outline" title="Cook it" style={{ flex: 1 }} onPress={() => router.push(`/recipe/${c.recipe.id}`)} />
          {isToday
            ? <Button small variant={eaten ? 'tinted' : 'ghost'} icon={eaten ? 'checkmark' : 'add'} title={eaten ? 'Eaten' : 'I ate this'} style={{ flex: 1 }} onPress={toggleEaten} />
            : <CopyButton label="Ingredients" text={() => mealPlanText([{ date, recipes: [c], portion }])} />}
        </View>
        {msgs.map((m) => (
          <View key={m.id} style={{ gap: 8, alignSelf: m.role === 'user' ? 'flex-end' : m.meals ? 'stretch' : 'flex-start', maxWidth: m.meals ? '100%' : '86%' }}>
            <Bubble role={m.role} text={m.text} />
            {!!m.noted?.length && <Text style={[T.caption, { paddingHorizontal: 6 }]}>Noted: {m.noted.join(' ')}</Text>}
            {m.meals && <MealPlanCard meals={m.meals} />}
          </View>
        ))}
        {busy && (
          <View style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 6, paddingVertical: 11, paddingHorizontal: 15, gap: 4, ...shadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkles" size={13} color={C.accent} />
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 }}>THINKING</Text>
            </View>
            {!!thought && <Text style={{ fontSize: 14, lineHeight: 19, color: C.text2, fontStyle: 'italic' }}>{thought}</Text>}
          </View>
        )}
        {!msgs.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={({ pressed }) => [{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: C.card }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: C.accent, fontWeight: '700', fontSize: 14 }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginBottom: Math.max(10, insets.bottom + 6), padding: 6, backgroundColor: '#fff', borderRadius: 26, ...shadow }}>
        <TextInput value={text} onChangeText={setText} placeholder={`Ask about this ${meal}`} placeholderTextColor={C.text3} onSubmitEditing={() => send(text)} returnKeyType="send" submitBehavior="submit"
          style={{ flex: 1, fontSize: 16, paddingHorizontal: 12, color: C.text, minHeight: 40 }} />
        <Pressable onPress={() => send(text)} disabled={!text.trim() || busy} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() && !busy ? C.night : C.fill2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={20} color={C.skyLight} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

function Bubble({ role, text }: { role: ChatMessage['role']; text: string }) {
  const mine = role === 'user'
  return (
    <View style={[{ alignSelf: mine ? 'flex-end' : 'flex-start', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20 }, mine ? { backgroundColor: C.night, borderBottomRightRadius: 6 } : { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow }]}>
      <Text selectable style={{ fontSize: 15, lineHeight: 21, color: mine ? C.cloud : C.text }}>{text}</Text>
    </View>
  )
}
