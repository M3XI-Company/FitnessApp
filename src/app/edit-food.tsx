import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useStore } from '../lib/store'
import { MEALS } from '../lib/meals'
import { SOURCES } from '../lib/sources'
import { round } from '../lib/nutrition'
import type { MealSlot } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Field, Pill, SheetHeader, Stepper, success, tap } from '../components/ui'

/** Edit any logged food: amount, meal, and the nutrition values themselves. */
export default function EditFood() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { state, dispatch } = useStore()
  const entry = state.food.find((f) => f.id === id)
  const [meal, setMeal] = useState<MealSlot>(entry?.meal ?? 'snack')
  const [amount, setAmount] = useState(entry?.grams ?? entry?.qty ?? 1)
  const [vals, setVals] = useState(() => ({ kcal: String(round(entry?.kcal ?? 0)), protein: String(round(entry?.protein ?? 0, 1)), carbs: String(round(entry?.carbs ?? 0, 1)), fat: String(round(entry?.fat ?? 0, 1)) }))
  if (!entry) return <View style={{ flex: 1, backgroundColor: C.bg }}><SheetHeader title="Not found" onClose={() => router.back()} /></View>

  const byGrams = !!entry.grams
  const base = byGrams ? entry.grams! : entry.qty
  // changing the amount rescales the values proportionally
  const rescale = (next: number) => {
    const f = next / (byGrams ? amount : amount || 1)
    setAmount(next)
    setVals((v) => ({ kcal: String(round(+v.kcal * f)), protein: String(round(+v.protein * f, 1)), carbs: String(round(+v.carbs * f, 1)), fat: String(round(+v.fat * f, 1)) }))
  }
  const save = () => {
    dispatch({ type: 'updateFood', entry: {
      ...entry, meal, kcal: +vals.kcal || 0, protein: +vals.protein || 0, carbs: +vals.carbs || 0, fat: +vals.fat || 0,
      ...(byGrams ? { grams: amount } : { qty: amount }),
      // a person correcting values makes them their own, but keep the estimate flag visible until they change macros
      isEstimate: entry.isEstimate && vals.kcal === String(round(entry.kcal * (amount / base))),
    } })
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
              {entry.isEstimate && <Pill color={C.orange} bg="#F8EBD8">Estimate</Pill>}
            </View>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MEALS.map((m) => (
            <Pressable key={m.slot} onPress={() => { tap(); setMeal(m.slot) }} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.ink : C.card }}>
              <Text style={{ fontWeight: '600', color: meal === m.slot ? C.goldLight : C.text2 }}>{m.emoji} {m.label}</Text>
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
                <Field keyboardType="decimal-pad" value={vals[k]} onChangeText={(v) => setVals({ ...vals, [k]: v })} style={{ textAlign: 'center', paddingHorizontal: 6 }} />
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
