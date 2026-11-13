import { useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../lib/store'
import { searchCofid } from '../lib/foodDb'
import { searchUkProducts } from '../lib/products'
import { SOURCES } from '../lib/sources'
import { defaultMeal, mealLabel, useMeals } from '../lib/meals'
import { todayKey, uid } from '../lib/date'
import { fmt, makeEntry, mealNutrition, nutritionFor, type Amount } from '../lib/nutrition'
import type { FoodItem, MealSlot, SavedMeal } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Field, Grade, Icon, IconTile, SearchField, Segmented, SheetHeader, Stepper, success, tap } from '../components/ui'
import { FoodIcon } from '../components/foodIcons'

type Mode = 'search' | 'recent' | 'favourites' | 'meals' | 'manual'

export default function AddFood() {
  const params = useLocalSearchParams<{ meal?: MealSlot; mode?: 'meals' }>()
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const [meal, setMeal] = useState<MealSlot>(params.meal ?? defaultMeal())
  const [mode, setMode] = useState<Mode>(params.mode ?? 'search')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [qty, setQty] = useState(1)
  const [grams, setGrams] = useState(100)
  const [online, setOnline] = useState<FoodItem[] | null>(null)
  const [onlineState, setOnlineState] = useState<'idle' | 'loading' | 'error'>('idle')
  const amount: Amount = picked?.servingG ? { grams } : { servings: qty }
  const preview = picked ? nutritionFor(picked, amount) : null
  const pick = (item: FoodItem) => { setPicked(item); setQty(1); setGrams(item.servingG ?? 100) }
  const searchOnline = async () => {
    setOnlineState('loading')
    const res = await searchUkProducts(q)
    if (res === null) { setOnlineState('error'); return }
    setOnline(res); setOnlineState('idle')
  }
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })

  const recent = useMemo(() => {
    const seen = new Map<string, FoodItem>()
    for (const f of [...state.food].reverse()) {
      if (seen.has(f.name)) continue
      // per logged amount: by weight when we know the grams, else per serving
      const per = f.grams ? 1 : f.qty || 1
      seen.set(f.name, { id: f.id, name: f.name, brand: f.brand, emoji: f.emoji, source: f.dataSource, serving: f.grams ? `${Math.round(f.grams)} g` : f.serving, servingG: f.grams, kcal: f.kcal / per, protein: f.protein / per, carbs: f.carbs / per, fat: f.fat / per })
    }
    return [...seen.values()].slice(0, 20)
  }, [state.food])

  const meals = useMeals()
  const favKey = (i: FoodItem) => `${i.name}|${i.servingG ?? i.serving}`
  const isFav = (i: FoodItem) => state.favourites.some((f) => favKey(f) === favKey(i))
  const logMeal = (m: SavedMeal) => {
    dispatch({ type: 'logEntries', entries: m.items.map(({ item, amount: a }) => makeEntry(item, a, { id: uid(), date: todayKey(), meal, source: 'search', dataSource: item.source })) })
    success(); router.back()
  }
  const add = (item: FoodItem, amt: Amount, source: 'search' | 'boxed' | 'manual' = 'search') => {
    dispatch({ type: 'addFood', entry: makeEntry(item, amt, {
      id: uid(), date: todayKey(), meal, source,
      dataSource: item.source ?? (source === 'manual' ? 'manual' : source === 'boxed' ? 'boxed' : undefined),
    }) })
    success()
    router.back()
  }

  const list = mode === 'search' ? [...searchCofid(q), ...(online ?? [])] : mode === 'favourites' ? state.favourites : recent
  const row = (item: FoodItem) => (
    <Pressable key={item.id} onPress={() => pick(item)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: picked?.id === item.id ? C.accentSoft : C.card, borderRadius: 16, marginBottom: 8 }, pressed && { opacity: 0.8 }]}>
      <FoodIcon name={item.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={T.headline} numberOfLines={1}>{item.name}</Text>
        <Text style={T.sub} numberOfLines={1}>{Math.round(item.kcal)} kcal · {item.serving}{item.brand ? ` · ${item.brand}` : ''} · {item.source ? SOURCES[item.source].short : 'Recent'}</Text>
      </View>
      <Grade g={item.grade} size={26} />
      <Icon name={picked?.id === item.id ? 'checkmark-circle' : 'add-circle'} size={26} color={C.accent} />
    </Pressable>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title="Add food" onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {meals.map((m) => (
            <Pressable key={m.slot} onPress={() => setMeal(m.slot)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.text : C.card }}>
              <Text style={{ fontWeight: '600', color: meal === m.slot ? '#fff' : C.text2 }}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Card tight onPress={() => router.push({ pathname: '/food-photo', params: { meal } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconTile icon="camera" size={34} color={C.skyLight} bg={C.night} /><View style={{ flex: 1 }}><Text style={T.headline}>Snap your meal</Text><Text style={T.caption}>AI identifies it · UK nutrition data</Text></View><Icon name="chevron-forward" color={C.text3} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['barcode-outline', 'Scan barcode', 'barcode'], ['scan-outline', 'Product scan', 'product']] as const).map(([icon, label, m]) => (
            <Card key={m} tight onPress={() => router.push({ pathname: '/scanner', params: { mode: m, meal } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconTile icon={icon} size={34} /><Text style={T.headline}>{label}</Text>
            </Card>
          ))}
        </View>
        <Segmented value={mode} onChange={(v) => { setMode(v); setPicked(null) }} options={[{ value: 'search', label: 'Search' }, { value: 'recent', label: 'Recent' }, { value: 'favourites', label: 'Starred' }, { value: 'meals', label: 'Meals' }, { value: 'manual', label: 'Manual' }]} />
        {mode === 'search' && <SearchField value={q} onChangeText={(v) => { setQ(v); setOnline(null); setOnlineState('idle') }} placeholder="Search 2,800+ UK foods" />}
      </View>

      {(mode === 'search' || mode === 'recent' || mode === 'favourites') && (
        <FlatList data={list} keyExtractor={(i) => i.id} renderItem={({ item }) => row(item)} contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled"
          ListFooterComponent={mode === 'search' ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              {q.trim().length > 1 && online === null && (
                <Button variant="tinted" icon="cart-outline" title={onlineState === 'loading' ? 'Searching UK products…' : `Search UK branded products for “${q.trim()}”`} disabled={onlineState === 'loading'} onPress={searchOnline} />
              )}
              {onlineState === 'error' && <Text style={[T.sub, { textAlign: 'center' }]}>{"Couldn't reach Open Food Facts. Try again in a moment."}</Text>}
              {online !== null && online.length === 0 && <Text style={[T.sub, { textAlign: 'center' }]}>No UK branded products found.</Text>}
              <Text style={[T.caption, { lineHeight: 16 }]}>Generic foods: {SOURCES.cofid.attribution}{online ? ` Branded products: ${SOURCES.off.attribution}` : ''}</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={<Text style={[T.sub, { textAlign: 'center', marginTop: 30 }]}>{mode === 'recent' ? 'Nothing logged yet.' : mode === 'favourites' ? 'Tap the star on any food to keep it here.' : `No results for “${q}”. Try scanning the barcode or add it manually.`}</Text>} />
      )}

      {mode === 'meals' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 10 }}>
          <Button variant="tinted" icon="add" title="New custom meal" onPress={() => router.push('/meal-builder')} />
          {state.savedMeals.length === 0 && <Text style={[T.sub, { textAlign: 'center', marginTop: 16, lineHeight: 19 }]}>Save a meal from your diary, or build a custom one, to log it again in one tap.</Text>}
          {state.savedMeals.map((sm) => {
            const n = mealNutrition(sm.items)
            return (
              <Card key={sm.id} tight onPress={() => logMeal(sm)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <FoodIcon name={sm.items[0]?.item.name ?? sm.name} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={T.headline} numberOfLines={1}>{sm.name}</Text>
                  <Text style={T.sub}>{fmt.kcal(n.kcal)} kcal · {fmt.g(n.protein)} g protein · {sm.items.length} item{sm.items.length === 1 ? '' : 's'}</Text>
                </View>
                <Pressable onPress={() => router.push({ pathname: '/meal-builder', params: { id: sm.id } })} hitSlop={8} accessibilityLabel={`Edit ${sm.name}`}><Icon name="create-outline" size={22} color={C.text2} /></Pressable>
                <Icon name="add-circle" size={26} color={C.accent} />
              </Card>
            )
          })}
        </ScrollView>
      )}

      {mode === 'manual' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Field placeholder="Food name" value={manual.name} onChangeText={(v) => setManual({ ...manual, name: v })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <View key={k} style={{ flex: 1 }}>
                <Text style={[T.caption, { marginBottom: 4, marginLeft: 4 }]}>{k === 'kcal' ? 'Calories' : `${k[0].toUpperCase()}${k.slice(1)} g`}</Text>
                <Field keyboardType="decimal-pad" placeholder="0" value={manual[k]} onChangeText={(v) => setManual({ ...manual, [k]: v })} style={{ textAlign: 'center', paddingHorizontal: 6 }} />
              </View>
            ))}
          </View>
          <Button title="Add to diary" disabled={!manual.name || !manual.kcal} onPress={() => add({ id: uid(), name: manual.name, serving: '1 serving', emoji: '🍽️', kcal: +manual.kcal || 0, protein: +manual.protein || 0, carbs: +manual.carbs || 0, fat: +manual.fat || 0 }, { servings: 1 }, 'manual')} />
        </ScrollView>
      )}

      {picked && (mode === 'search' || mode === 'recent' || mode === 'favourites') && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 18 + insets.bottom, gap: 14, boxShadow: '0 -10px 40px rgba(15,30,60,.12)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable onPress={() => { tap(); dispatch({ type: 'toggleFavourite', item: picked }) }} hitSlop={8} accessibilityLabel={isFav(picked) ? 'Remove from favourites' : 'Add to favourites'}>
              <Icon name={isFav(picked) ? 'star' : 'star-outline'} size={26} color={C.sky} />
            </Pressable>
            <View style={{ flex: 1 }}><Text style={T.title3} numberOfLines={1}>{picked.name}</Text><Text style={T.sub}>{picked.servingG ? `${picked.serving} = ${Math.round(picked.kcal)} kcal` : picked.serving}</Text></View>
            {picked.servingG ? <Stepper value={grams} step={10} min={5} suffix="g" onChange={setGrams} /> : <Stepper value={qty} step={0.5} min={0.5} onChange={setQty} />}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {([['Calories', fmt.kcal(preview!.kcal), ''], ['Protein', fmt.g(preview!.protein), 'g'], ['Carbs', fmt.g(preview!.carbs), 'g'], ['Fat', fmt.g(preview!.fat), 'g']] as const).map(([l, v, u]) => (
              <View key={l} style={{ alignItems: 'center' }}><Text style={[T.title3, T.num]}>{v}{u}</Text><Text style={T.caption}>{l}</Text></View>
            ))}
          </View>
          <Button title={`Add to ${mealLabel(meal, meals)}`} onPress={() => add(picked, amount)} />
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
