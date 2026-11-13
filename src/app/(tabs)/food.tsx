import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../../lib/store'
import { addDays, prettyDate, todayKey, uid } from '../../lib/date'
import { ZERO, dayTotals, fmt } from '../../lib/nutrition'
import { useMeals } from '../../lib/meals'
import type { FoodEntry } from '../../lib/types'
import { WaterCard } from '../../components/WaterCard'
import { C, T } from '../../theme'
import { Bar, Button, Card, Field, Icon, IconButton, IconTile, Screen, SectionHeader, success, tap } from '../../components/ui'


const st = {
  mealAction: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.sep },
  mealActionText: { color: C.accent, fontWeight: '600' as const, fontSize: 14 },
}

export default function Food() {
  const { state, dispatch } = useStore()
  const [date, setDate] = useState(todayKey())
  const [editing, setEditing] = useState(false)
  const t = state.targets
  const day = dayTotals(state.food, date)
  const m = day.total
  const isToday = date === todayKey()
  const meals = useMeals()
  const [newCat, setNewCat] = useState<string | null>(null)
  const yesterday = dayTotals(state.food, addDays(date, -1)).entries
  // copy entries to this day with new ids; values are already exact, so nothing is recalculated
  const copy = (from: FoodEntry[], slot: string) => {
    dispatch({ type: 'logEntries', entries: from.map((e) => ({ ...e, id: uid(), date, meal: slot, demo: undefined })) })
    success()
  }

  return (
    <Screen title="Food" right={
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <IconButton icon="barcode-outline" onPress={() => router.push({ pathname: '/scanner', params: { mode: 'barcode' } })} label="Scan barcode" />
        <IconButton icon="add" variant="blue" onPress={() => router.push('/add-food')} label="Add food" />
      </View>
    }>
      {/* Date switcher */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <IconButton icon="chevron-back" variant="fill" size={34} onPress={() => setDate(addDays(date, -1))} label="Previous day" />
        <Text style={T.headline}>{isToday ? 'Today' : prettyDate(date)}</Text>
        <IconButton icon="chevron-forward" variant="fill" size={34} onPress={() => !isToday && setDate(addDays(date, 1))} label="Next day" />
      </View>

      {/* Summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={[T.title1, T.num]}>{fmt.kcal(m.kcal)} <Text style={[T.headline, { color: C.text3 }]}>/ {t.kcal} kcal</Text></Text>
          <Pressable onPress={() => { tap(); router.push('/targets') }} hitSlop={8}><Text style={[T.sub, { color: C.accent, fontWeight: '700' }]}>Targets ›</Text></Pressable>
        </View>
        <View style={{ marginTop: 10 }}><Bar pct={m.kcal / t.kcal} color={m.kcal > t.kcal ? C.orange : C.accent} height={10} /></View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
          {([['Protein', m.protein, t.protein, C.protein], ['Carbs', m.carbs, t.carbs, C.carbs], ['Fat', m.fat, t.fat, C.fat]] as const).map(([l, v, max, c]) => (
            <View key={l} style={{ flex: 1, gap: 6 }}>
              <Text style={T.caption}>{l}</Text>
              <Bar pct={v / max} color={c} height={6} />
              <Text style={[T.sub, T.num]}><Text style={{ color: C.text, fontWeight: '700' }}>{fmt.g(v)}</Text>/{max}g</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, marginRight: 4 }}>
        <Pressable onPress={() => { tap(); setEditing(!editing) }} hitSlop={10}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>{editing ? 'Done' : 'Edit'}</Text></Pressable>
      </View>

      {/* Meals */}
      <View style={{ gap: 12, marginTop: 8 }}>
        {meals.map((meal) => {
          const items = day.entries.filter((f) => f.meal === meal.slot)
          const sum = day.byMeal[meal.slot] ?? ZERO
          return (
            <Card key={meal.slot} style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <IconTile emoji={meal.emoji} size={44} bg={C.fill} />
                <View style={{ flex: 1 }}>
                  <Text style={T.title3}>{meal.label}</Text>
                  <Text style={T.sub}>{fmt.kcal(sum.kcal)}{meal.share ? ` / ${Math.round(t.kcal * meal.share)}` : ''} kcal · {fmt.g(sum.protein)} g protein</Text>
                </View>
                {editing && !['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.slot) && (
                  <IconButton icon="trash-outline" variant="fill" size={34} onPress={() => dispatch({ type: 'removeCategory', slot: meal.slot })} label={`Remove ${meal.label}`} />
                )}
                <IconButton icon="add" variant="fill" size={34} onPress={() => router.push({ pathname: '/add-food', params: { meal: meal.slot } })} label={`Add to ${meal.label}`} />
              </View>
              {items.map((f) => (
                <Pressable key={f.id} onPress={() => { tap(); router.push({ pathname: '/edit-food', params: { id: f.id } }) }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
                  {editing && (
                    <Pressable onPress={() => { tap(); dispatch({ type: 'removeFood', id: f.id }) }} accessibilityLabel={`Delete ${f.name}`}>
                      <Icon name="remove-circle" size={24} color={C.red} />
                    </Pressable>
                  )}
                  <Text style={{ fontSize: 22 }}>{f.emoji ?? '🍽️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={T.caption}>{f.grams ? `${f.grams} g` : `${f.qty !== 1 ? `${f.qty} × ` : ''}${f.serving}`}{f.brand ? ` · ${f.brand}` : ''}{f.isEstimate ? ' · estimate' : ''}</Text>
                  </View>
                  <Text style={[T.headline, T.num]}>{fmt.kcal(f.kcal)}</Text>
                </Pressable>
              ))}
              {(() => {
                const prev = yesterday.filter((e) => e.meal === meal.slot)
                if (items.length) return (
                  <Pressable onPress={() => { tap(); router.push({ pathname: '/meal-builder', params: { date, slot: meal.slot } }) }} style={st.mealAction}>
                    <Icon name="bookmark-outline" size={16} color={C.accent} /><Text style={st.mealActionText}>Save as a meal</Text>
                  </Pressable>
                )
                if (prev.length) return (
                  <Pressable onPress={() => { tap(); copy(prev, meal.slot) }} style={st.mealAction}>
                    <Icon name="copy-outline" size={16} color={C.accent} /><Text style={st.mealActionText}>Copy yesterday’s {meal.label.toLowerCase()} ({fmt.kcal(prev.reduce((a, e) => a + e.kcal, 0))} kcal)</Text>
                  </Pressable>
                )
                return null
              })()}
            </Card>
          )
        })}
      </View>

      {/* Custom meal categories */}
      {newCat === null ? (
        <Pressable onPress={() => { tap(); setNewCat('') }} style={[st.mealAction, { justifyContent: 'center', marginTop: 12 }]}>
          <Icon name="add-circle-outline" size={18} color={C.accent} /><Text style={st.mealActionText}>Add a meal category</Text>
        </Pressable>
      ) : (
        <Card style={{ marginTop: 12, gap: 10 }}>
          <Field autoFocus placeholder="e.g. Pre-workout, Second breakfast" value={newCat} onChangeText={setNewCat} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small variant="ghost" title="Cancel" style={{ flex: 1 }} onPress={() => setNewCat(null)} />
            <Button small title="Add" style={{ flex: 1 }} disabled={!newCat.trim() || meals.some((x) => x.label.toLowerCase() === newCat.trim().toLowerCase())}
              onPress={() => { dispatch({ type: 'addCategory', category: { slot: `custom-${uid()}`, label: newCat.trim(), emoji: '🍴' } }); setNewCat(null) }} />
          </View>
        </Card>
      )}

      <SectionHeader title="Water" action="Plan" onAction={() => router.push({ pathname: '/plans', params: { tab: 'water' } })} />
      <WaterCard date={date} />
    </Screen>
  )
}
