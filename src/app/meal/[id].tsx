import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { eatenOn, mealPlanText, mealsFor, thinkingLine } from '../../lib/chat'
import { askCoach, coachConfigured } from '../../lib/coachApi'
import { prettyDate, todayKey, uid } from '../../lib/date'
import { SHOPS, cookingVideoUrl, shopUrl, similarRecipesUrl, type ShopId } from '../../lib/links'
import { fmt, makeEntry } from '../../lib/nutrition'
import { recipeById } from '../../lib/recipes'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T, shadow } from '../../theme'
import { MealPlanCard } from '../../components/coach/PlanCard'
import { CopyButton } from '../../components/chat/DayCard'
import { LiftingDumbbell } from '../../components/chat/LiftingDumbbell'
import { FoodIcon } from '../../components/foodIcons'
import { Photo } from '../../components/Photo'
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
  const [showIngredients, setShowIngredients] = useState(false)
  const [shop, setShop] = useState<ShopId>('tesco')
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
        <Photo id={c.recipe.id} label={`A photo of ${c.recipe.title}`} style={{ width: '100%', height: 190, borderRadius: 22 }} />
        <Bubble role="coach" text={opening} />
        {/* what goes in it: folded away until asked for, every item on the same tile, each with where to buy it */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, ...shadow }}>
          <Pressable onPress={() => { tap(); setShowIngredients(!showIngredients) }} accessibilityRole="button" accessibilityState={{ expanded: showIngredients }}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 15 }, pressed && { opacity: 0.6 }]}>
            <Icon name="cart-outline" size={18} color={C.accent} />
            <Text style={[T.headline, { flex: 1, fontSize: 15 }]}>Ingredients</Text>
            <Text style={[T.caption, T.num]}>{c.ingredients.length} items</Text>
            <View style={{ transform: [{ rotate: showIngredients ? '-90deg' : '90deg' }] }}><Icon name="chevron-forward" size={18} color={C.text3} /></View>
          </Pressable>
          {showIngredients && (
            <View style={{ paddingHorizontal: 15, paddingBottom: 13, gap: 10 }}>
              {c.ingredients.map((i, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <FoodIcon name={i.food.name} size={42} bg={C.card} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{i.label}</Text>
                    <Text style={[T.caption, T.num]}>{fmt.g0((i.grams / c.recipe.servings) * portion)} g</Text>
                  </View>
                  <Pressable onPress={() => { tap(); Linking.openURL(shopUrl(shop, i.label)) }} accessibilityRole="link" accessibilityLabel={`Shop ${i.label} at ${SHOPS.find((s) => s.id === shop)?.name}`} hitSlop={6}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.card }, pressed && { opacity: 0.6 }]}>
                    <Text style={{ color: C.accent, fontWeight: '700', fontSize: 13 }}>Shop</Text>
                    <Icon name="open-outline" size={13} color={C.accent} />
                  </Pressable>
                </View>
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={T.caption}>Shop at</Text>
                {SHOPS.map((s) => (
                  <Pressable key={s.id} onPress={() => { tap(); setShop(s.id) }} accessibilityRole="button" accessibilityState={{ selected: shop === s.id }}
                    style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 13, backgroundColor: shop === s.id ? C.night : C.card }}>
                    <Text style={{ color: shop === s.id ? C.cloud : C.text2, fontWeight: '600', fontSize: 12 }}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={T.caption}>Each link opens that item at the shop, where you see the price and check out.</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small icon="book-outline" title="Cook it" style={{ flex: 1 }} onPress={() => router.push(`/recipe/${c.recipe.id}`)} />
          {isToday
            ? <Button small variant={eaten ? 'tinted' : 'ghost'} icon={eaten ? 'checkmark' : 'add'} title={eaten ? 'Eaten' : 'I ate this'} style={{ flex: 1 }} onPress={toggleEaten} />
            : <CopyButton label="Ingredients" text={() => mealPlanText([{ date, recipes: [c], portion }])} />}
        </View>
        <View style={{ gap: 2 }}>
          <Pressable onPress={() => { tap(); Linking.openURL(cookingVideoUrl(c.recipe.title)) }} accessibilityRole="link" hitSlop={4} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}>
            <Icon name="play" size={16} color={C.accent} />
            <Text style={{ color: C.accent, fontWeight: '600', fontSize: 14 }}>Watch it being cooked on YouTube</Text>
          </Pressable>
          {/* our recipes are written for the app, so this is further reading rather than a source */}
          <Pressable onPress={() => { tap(); Linking.openURL(similarRecipesUrl(c.recipe.title)) }} accessibilityRole="link" hitSlop={4} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}>
            <Icon name="open-outline" size={14} color={C.text3} />
            <Text style={[T.caption, { color: C.text2 }]}>Compare with similar recipes on BBC Good Food</Text>
          </Pressable>
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
              <LiftingDumbbell />
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
