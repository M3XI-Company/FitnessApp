import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useStore } from '../lib/store'
import { useMeals } from '../lib/meals'
import { SOURCES } from '../lib/sources'
import { fmt, rescaleEntry } from '../lib/nutrition'
import type { FoodEntry, MealSlot } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Field, Pill, SheetHeader, Stepper, success, tap } from '../components/ui'

type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat'

/** Edit any logged food: amount, meal, and the nutrition values themselves. */
export default function EditFood() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { state, dispatch } = useStore()
  const meals = useMeals()
  const entry = state.food.find((f) => f.id === id)
  const [meal, setMeal] = useState<MealSlot>(entry?.meal ?? 'snack')
  const [draft, setDraft] = useState<FoodEntry | undefined>(entry)
  // text the user is typing into a nutrition field (null = show the computed value)
  const [text, setText] = useState<Partial<Record<MacroKey, string>>>({})
  const [edited, setEdited] = useState(false)
  if (!entry || !draft) return <View style={{ flex: 1, backgroundColor: C.bg }}><SheetHeader title="Not found" onClose={() => router.back()} /></View>

  const byGrams = !!entry.grams
  const amount = byGrams ? draft.grams! : draft.qty
  // changing the amount rescales every value proportionally (via the shared nutrition engine)
  const rescale = (next: number) => { setDraft(rescaleEntry(draft, byGrams ? { grams: next } : { qty: next })); setText({}) }
  const shown = (k: MacroKey) => text[k] ?? String(k === 'kcal' ? fmt.kcal(draft[k]) : fmt.g(draft[k]))
  const type = (k: MacroKey, v: string) => {
    setText({ ...text, [k]: v }); setEdited(true)
    const n = parseFloat(v.replace(',', '.'))
    setDraft({ ...draft, [k]: isNaN(n) ? 0 : n })
  }
  const save = () => {
    // values a person typed in are theirs, not an estimate any more
    dispatch({ type: 'updateFood', entry: { ...draft, meal, isEstimate: entry.isEstimate && !edited, dataSource: edited ? 'manual' : draft.dataSource } })
    success(); router.back()
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SheetHeader title="Edit entry" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 30 }}>{entry.emoji ?? '🍽️'}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={T.title3} numberOfLines={2}>{entry.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {entry.dataSource && <Pill color={C.text2} bg={C.fill}>{SOURCES[entry.dataSource].short}</Pill>}
              {entry.isEstimate && <Pill color={C.orange} bg="#FFEBDD">Estimate</Pill>}
            </View>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {meals.map((m) => (
            <Pressable key={m.slot} onPress={() => { tap(); setMeal(m.slot) }} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.night : C.card }}>
              <Text style={{ fontWeight: '600', color: meal === m.slot ? C.skyLight : C.text2 }}>{m.emoji} {m.label}</Text>
            </Pressable>
          ))}
        </View>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={T.headline}>{byGrams ? 'Amount' : 'Servings'}</Text>
          <Stepper value={amount} step={byGrams ? 10 : 0.5} min={byGrams ? 5 : 0.5} suffix={byGrams ? 'g' : undefined} onChange={rescale} />
        </Card>
        <Card style={{ gap: 10 }}>
          <Text style={T.headline}>Nutrition</Text>
          <Text style={T.caption}>Correct these if the label or your portion differs.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <View key={k} style={{ flex: 1 }}>
                <Text style={[T.caption, { marginBottom: 4, marginLeft: 4 }]}>{k === 'kcal' ? 'kcal' : `${k[0].toUpperCase()}${k.slice(1)} g`}</Text>
                <Field keyboardType="decimal-pad" value={shown(k)} onChangeText={(v) => type(k, v)} style={{ textAlign: 'center', paddingHorizontal: 6 }} />
              </View>
            ))}
          </View>
        </Card>
        <Button title="Save changes" onPress={save} />
        <Button title="Delete entry" variant="ghost" icon="trash-outline" onPress={() => { dispatch({ type: 'removeFood', id: entry.id }); router.back() }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
