import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useStore } from '../lib/store'
import { searchCofid } from '../lib/foodDb'
import { entryToItem, fmt, mealNutrition, nutritionFor } from '../lib/nutrition'
import { uid } from '../lib/date'
import type { Amount, FoodItem, SavedMeal } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Field, Icon, SearchField, SheetHeader, Stepper, success, tap } from '../components/ui'

type Line = { key: string; item: FoodItem; amount: Amount }

/**
 * Build a custom meal, or save a diary meal for reuse.
 * Params: ?date=YYYY-MM-DD&slot=lunch prefills from the diary; ?id= edits an existing saved meal.
 */
export default function MealBuilder() {
  const { date, slot, id } = useLocalSearchParams<{ date?: string; slot?: string; id?: string }>()
  const { state, dispatch } = useStore()
  const existing = state.savedMeals.find((m) => m.id === id)
  const fromDiary = date && slot ? state.food.filter((f) => f.date === date && f.meal === slot) : []
  const [name, setName] = useState(existing?.name ?? '')
  const [lines, setLines] = useState<Line[]>(() =>
    existing ? existing.items.map((i) => ({ key: uid(), ...i })) : fromDiary.map((e) => ({ key: uid(), ...entryToItem(e) })))
  const [q, setQ] = useState('')
  const results = q.trim().length > 1 ? searchCofid(q, 8) : state.favourites.slice(0, 8)

  const setAmount = (key: string, v: number) => setLines((ls) => ls.map((l) => (l.key !== key ? l : { ...l, amount: 'grams' in l.amount ? { grams: v } : { servings: v } })))
  const total = mealNutrition(lines)
  const save = () => {
    const meal: SavedMeal = { id: existing?.id ?? uid(), name: name.trim(), emoji: lines[0]?.item.emoji ?? '🍽️', kind: fromDiary.length || existing?.kind === 'saved' ? 'saved' : 'custom', items: lines.map(({ item, amount }) => ({ item, amount })), createdAt: existing?.createdAt ?? new Date().toISOString() }
    dispatch({ type: 'saveMeal', meal })
    success(); router.back()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title={existing ? 'Edit meal' : fromDiary.length ? 'Save meal' : 'New custom meal'} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field placeholder="Meal name, e.g. Post-gym breakfast" value={name} onChangeText={setName} />
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={T.title3}>{fmt.kcal(total.kcal)} kcal</Text>
            <Text style={T.sub}>{fmt.g(total.protein)}P · {fmt.g(total.carbs)}C · {fmt.g(total.fat)}F</Text>
          </View>
          {lines.length === 0 && <Text style={T.sub}>Add foods below.</Text>}
          {lines.map((l) => {
            const n = nutritionFor(l.item, l.amount)
            const byGrams = 'grams' in l.amount
            return (
              <View key={l.key} style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>{l.item.emoji ?? '🍽️'}</Text>
                  <Text style={[T.body, { flex: 1, fontWeight: '600' }]} numberOfLines={2}>{l.item.name}</Text>
                  <Pressable onPress={() => { tap(); setLines(lines.filter((x) => x.key !== l.key)) }} hitSlop={8} accessibilityLabel={`Remove ${l.item.name}`}><Icon name="remove-circle" color={C.red} size={22} /></Pressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={T.sub}>{fmt.kcal(n.kcal)} kcal</Text>
                  <Stepper value={byGrams ? (l.amount as { grams: number }).grams : (l.amount as { servings: number }).servings} step={byGrams ? 10 : 0.5} min={byGrams ? 5 : 0.5} suffix={byGrams ? 'g' : '×'} onChange={(v) => setAmount(l.key, v)} />
                </View>
              </View>
            )
          })}
        </Card>
        <SearchField value={q} onChangeText={setQ} placeholder="Add a UK food…" />
        {q.trim().length <= 1 && state.favourites.length > 0 && <Text style={[T.eyebrow, { marginLeft: 4 }]}>Favourites</Text>}
        {results.map((f) => (
          <Card key={f.id} tight onPress={() => { setLines([...lines, { key: uid(), item: f, amount: f.servingG ? { grams: f.servingG } : { servings: 1 } }]); setQ('') }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>{f.emoji ?? '🍽️'}</Text>
            <View style={{ flex: 1 }}><Text style={T.headline} numberOfLines={1}>{f.name}</Text><Text style={T.caption}>{fmt.kcal(f.kcal)} kcal · {f.serving}</Text></View>
            <Icon name="add-circle" color={C.accent} size={24} />
          </Card>
        ))}
        <Button title="Save meal" disabled={!name.trim() || lines.length === 0} onPress={save} />
        {existing && <Button title="Delete meal" variant="ghost" icon="trash-outline" onPress={() => { dispatch({ type: 'deleteSavedMeal', id: existing.id }); router.back() }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
