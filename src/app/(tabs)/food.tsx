import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../../lib/store'
import { dayMacros } from '../../lib/progress'
import { addDays, prettyDate, todayKey } from '../../lib/date'
import { round, sumMacros } from '../../lib/nutrition'
import { MEALS } from '../../lib/meals'
import { C, T } from '../../theme'
import { Bar, Card, Icon, IconButton, IconTile, Screen, tap } from '../../components/ui'


export default function Food() {
  const { state, dispatch } = useStore()
  const [date, setDate] = useState(todayKey())
  const [editing, setEditing] = useState(false)
  const t = state.targets
  const m = dayMacros(state, date)
  const isToday = date === todayKey()

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
          <Text style={[T.title1, T.num]}>{round(m.kcal)} <Text style={[T.headline, { color: C.text3 }]}>/ {t.kcal} kcal</Text></Text>
          <Text style={[T.sub, { color: m.kcal > t.kcal ? C.orange : C.accent, fontWeight: '700' }]}>{Math.round((m.kcal / t.kcal) * 100)}%</Text>
        </View>
        <View style={{ marginTop: 10 }}><Bar pct={m.kcal / t.kcal} color={m.kcal > t.kcal ? C.orange : C.accent} height={10} /></View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
          {([['Protein', m.protein, t.protein, C.protein], ['Carbs', m.carbs, t.carbs, C.carbs], ['Fat', m.fat, t.fat, C.fat]] as const).map(([l, v, max, c]) => (
            <View key={l} style={{ flex: 1, gap: 6 }}>
              <Text style={T.caption}>{l}</Text>
              <Bar pct={v / max} color={c} height={6} />
              <Text style={[T.sub, T.num]}><Text style={{ color: C.text, fontWeight: '700' }}>{round(v)}</Text>/{max}g</Text>
            </View>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, marginRight: 4 }}>
        <Pressable onPress={() => { tap(); setEditing(!editing) }} hitSlop={10}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>{editing ? 'Done' : 'Edit'}</Text></Pressable>
      </View>

      {/* Meals */}
      <View style={{ gap: 12, marginTop: 8 }}>
        {MEALS.map((meal) => {
          const items = state.food.filter((f) => f.date === date && f.meal === meal.slot)
          const sum = sumMacros(items)
          return (
            <Card key={meal.slot} style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <IconTile emoji={meal.emoji} size={44} bg={C.fill} />
                <View style={{ flex: 1 }}>
                  <Text style={T.title3}>{meal.label}</Text>
                  <Text style={T.sub}>{round(sum.kcal)} / {Math.round(t.kcal * meal.share)} kcal</Text>
                </View>
                <IconButton icon="add" variant="fill" size={34} onPress={() => router.push({ pathname: '/add-food', params: { meal: meal.slot } })} label={`Add to ${meal.label}`} />
              </View>
              {items.map((f) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }}>
                  {editing && (
                    <Pressable onPress={() => { tap(); dispatch({ type: 'removeFood', id: f.id }) }} accessibilityLabel={`Delete ${f.name}`}>
                      <Icon name="remove-circle" size={24} color={C.red} />
                    </Pressable>
                  )}
                  <Text style={{ fontSize: 22 }}>{f.emoji ?? '🍽️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={T.caption}>{f.qty !== 1 ? `${f.qty} × ` : ''}{f.serving}{f.brand ? ` · ${f.brand}` : ''}</Text>
                  </View>
                  <Text style={[T.headline, T.num]}>{Math.round(f.kcal)}</Text>
                </View>
              ))}
            </Card>
          )
        })}
      </View>

      {/* Plans entry */}
      <Card onPress={() => router.push({ pathname: '/plans', params: { tab: 'boxed' } })} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="cube" color="#fff" bg={C.accent} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>Boxed meals & ingredients</Text>
          <Text style={T.sub}>Plan your day, get a shopping list</Text>
        </View>
        <Icon name="chevron-forward" color={C.text3} />
      </Card>
    </Screen>
  )
}
