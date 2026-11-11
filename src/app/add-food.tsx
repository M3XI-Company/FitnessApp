import { useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../lib/store'
import { searchFoods } from '../data/foods'
import { BOXED_MEALS } from '../data/boxedMeals'
import { MEALS, defaultMeal } from '../lib/meals'
import { todayKey, uid } from '../lib/date'
import { round } from '../lib/nutrition'
import type { FoodItem, MealSlot } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Field, Grade, Icon, IconTile, SearchField, Segmented, SheetHeader, Stepper, success } from '../components/ui'

type Mode = 'search' | 'recent' | 'boxed' | 'manual'

export default function AddFood() {
  const params = useLocalSearchParams<{ meal?: MealSlot }>()
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const [meal, setMeal] = useState<MealSlot>(params.meal ?? defaultMeal())
  const [mode, setMode] = useState<Mode>('search')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<FoodItem | null>(null)
  const [qty, setQty] = useState(1)
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })

  const recent = useMemo(() => {
    const seen = new Map<string, FoodItem>()
    for (const f of [...state.food].reverse()) {
      if (!seen.has(f.name)) seen.set(f.name, { id: f.id, name: f.name, brand: f.brand, serving: f.serving, emoji: f.emoji, kcal: f.kcal / f.qty, protein: f.protein / f.qty, carbs: f.carbs / f.qty, fat: f.fat / f.qty })
    }
    return [...seen.values()].slice(0, 20)
  }, [state.food])

  const add = (item: FoodItem, n: number, source: 'search' | 'boxed' | 'manual' = 'search') => {
    dispatch({ type: 'addFood', entry: {
      id: uid(), date: todayKey(), meal, name: item.name, brand: item.brand, serving: item.serving, emoji: item.emoji, qty: n, source,
      kcal: item.kcal * n, protein: item.protein * n, carbs: item.carbs * n, fat: item.fat * n,
    } })
    success()
    router.back()
  }

  const list = mode === 'search' ? searchFoods(q) : recent
  const row = (item: FoodItem) => (
    <Pressable key={item.id} onPress={() => { setPicked(item); setQty(1) }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: picked?.id === item.id ? C.blue50 : C.card, borderRadius: 16, marginBottom: 8 }, pressed && { opacity: 0.8 }]}>
      <Text style={{ fontSize: 26 }}>{item.emoji ?? '🍽️'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={T.headline} numberOfLines={1}>{item.name}</Text>
        <Text style={T.sub}>{Math.round(item.kcal)} kcal · {item.serving}</Text>
      </View>
      <Grade g={item.grade} size={26} />
      <Icon name={picked?.id === item.id ? 'checkmark-circle' : 'add-circle'} size={26} color={C.blue} />
    </Pressable>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title="Add food" onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {MEALS.map((m) => (
            <Pressable key={m.slot} onPress={() => setMeal(m.slot)} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.text : C.card }}>
              <Text style={{ fontWeight: '600', color: meal === m.slot ? '#fff' : C.text2 }}>{m.emoji} {m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['barcode-outline', 'Scan barcode', 'barcode'], ['scan-outline', 'Product scan', 'product']] as const).map(([icon, label, m]) => (
            <Card key={m} tight onPress={() => router.push({ pathname: '/scanner', params: { mode: m, meal } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconTile icon={icon} size={34} /><Text style={T.headline}>{label}</Text>
            </Card>
          ))}
        </View>
        <Segmented value={mode} onChange={(v) => { setMode(v); setPicked(null) }} options={[{ value: 'search', label: 'Search' }, { value: 'recent', label: 'Recent' }, { value: 'boxed', label: 'Boxed' }, { value: 'manual', label: 'Manual' }]} />
        {mode === 'search' && <SearchField value={q} onChangeText={setQ} placeholder="Search foods" />}
      </View>

      {(mode === 'search' || mode === 'recent') && (
        <FlatList data={list} keyExtractor={(i) => i.id} renderItem={({ item }) => row(item)} contentContainerStyle={{ padding: 16, paddingBottom: 200 }} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[T.sub, { textAlign: 'center', marginTop: 30 }]}>{mode === 'recent' ? 'Nothing logged yet.' : `No results for “${q}”. Try scanning the barcode or add it manually.`}</Text>} />
      )}

      {mode === 'boxed' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 10 }}>
          {BOXED_MEALS.filter((b) => b.slot === meal || meal === 'snack').map((b) => (
            <Card key={b.id} tight onPress={() => add({ id: b.id, name: b.name, serving: '1 box', emoji: b.emoji, kcal: b.kcal, protein: b.protein, carbs: b.carbs, fat: b.fat }, 1, 'boxed')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile emoji={b.emoji} size={48} bg={C.fill} />
              <View style={{ flex: 1 }}>
                <Text style={T.headline} numberOfLines={1}>{b.name}</Text>
                <Text style={T.sub}>{b.kcal} kcal · {b.protein}g protein · {b.minutes} min</Text>
              </View>
              <Icon name="add-circle" size={26} color={C.blue} />
            </Card>
          ))}
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
          <Button title="Add to diary" disabled={!manual.name || !manual.kcal} onPress={() => add({ id: uid(), name: manual.name, serving: '1 serving', emoji: '🍽️', kcal: +manual.kcal || 0, protein: +manual.protein || 0, carbs: +manual.carbs || 0, fat: +manual.fat || 0 }, 1, 'manual')} />
        </ScrollView>
      )}

      {picked && (mode === 'search' || mode === 'recent') && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 18 + insets.bottom, gap: 14, boxShadow: '0 -10px 40px rgba(15,30,60,.12)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 30 }}>{picked.emoji}</Text>
            <View style={{ flex: 1 }}><Text style={T.title3} numberOfLines={1}>{picked.name}</Text><Text style={T.sub}>{picked.serving}</Text></View>
            <Stepper value={qty} step={0.5} min={0.5} onChange={setQty} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {([['Calories', picked.kcal, ''], ['Protein', picked.protein, 'g'], ['Carbs', picked.carbs, 'g'], ['Fat', picked.fat, 'g']] as const).map(([l, v, u]) => (
              <View key={l} style={{ alignItems: 'center' }}><Text style={[T.title3, T.num]}>{round(v * qty)}{u}</Text><Text style={T.caption}>{l}</Text></View>
            ))}
          </View>
          <Button title={`Add to ${MEALS.find((m) => m.slot === meal)!.label}`} onPress={() => add(picked, qty)} />
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
