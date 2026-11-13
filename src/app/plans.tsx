import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useStore } from '../lib/store'
import { allRecipes, recipeById, type ComputedRecipe } from '../lib/recipes'
import { addDays, todayKey, weekdayShort } from '../lib/date'
import { fmt, sumMacros } from '../lib/nutrition'
import { C, T } from '../theme'
import { Bar, Button, Card, Icon, IconTile, Pill, Segmented, SheetHeader, Stepper, tap } from '../components/ui'
import { WaterCard } from '../components/WaterCard'

type Tab = 'plan' | 'ingredients' | 'water'

export default function Plans() {
  const params = useLocalSearchParams<{ tab?: Tab }>()
  // 'boxed' links from older versions open the meal plan
  const [tab, setTab] = useState<Tab>(params.tab === 'ingredients' || params.tab === 'water' ? params.tab : 'plan')
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Plans" onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Meal plan' }, { value: 'ingredients', label: 'Ingredients' }, { value: 'water', label: 'Water plan' }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tab === 'plan' && <MealPlan />}
        {tab === 'ingredients' && <Ingredients />}
        {tab === 'water' && <WaterPlan />}
      </ScrollView>
    </View>
  )
}

function MealPlan() {
  const { state, dispatch } = useStore()
  const [day, setDay] = useState(todayKey())
  const [adding, setAdding] = useState(false)
  const planned = (state.boxedPlan[day] ?? []).map(recipeById).filter((x): x is ComputedRecipe => !!x)
  const total = sumMacros(planned.map((c) => c.perServing))
  const t = state.targets

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i)).map((d) => (
          <Pressable key={d} onPress={() => { tap(); setDay(d) }} style={{ width: 48, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 4, backgroundColor: d === day ? C.ink : C.card }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: d === day ? 'rgba(255,255,255,.8)' : C.text3 }}>{weekdayShort(d)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: d === day ? C.goldLight : C.text }}>{+d.slice(8)}</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: (state.boxedPlan[d] ?? []).some((id) => recipeById(id)) ? C.gold : 'transparent' }} />
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={T.title3}>{planned.length} recipe{planned.length === 1 ? '' : 's'} planned</Text>
          <Text style={[T.sub, T.num]}>{fmt.kcal(total.kcal)} / {t.kcal} kcal</Text>
        </View>
        <View style={{ marginTop: 10 }}><Bar pct={total.kcal / t.kcal} /></View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
          {([['protein', total.protein, t.protein], ['carbs', total.carbs, t.carbs], ['fat', total.fat, t.fat]] as const).map(([l, v, m]) => (
            <Text key={l} style={T.sub}><Text style={{ color: C.text, fontWeight: '700' }}>{fmt.g(v)}</Text>/{m} g {l}</Text>
          ))}
        </View>
        <Text style={[T.caption, { marginTop: 8 }]}>One serving of each planned recipe.</Text>
      </Card>

      {planned.map((c, i) => (
        <Card key={`${c.recipe.id}-${i}`} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => router.push(`/recipe/${c.recipe.id}`)}>
            <IconTile emoji={c.recipe.emoji} size={44} bg={C.fill} />
            <View style={{ flex: 1 }}><Text style={T.headline} numberOfLines={1}>{c.recipe.title}</Text><Text style={T.sub}>{fmt.kcal(c.perServing.kcal)} kcal · {fmt.g(c.perServing.protein)} g protein</Text></View>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => { tap(); dispatch({ type: 'toggleBoxed', date: day, mealId: c.recipe.id }) }} accessibilityLabel={`Remove ${c.recipe.title}`}><Icon name="remove-circle-outline" size={24} color={C.text3} /></Pressable>
        </Card>
      ))}

      <Button title={adding ? 'Done' : 'Add recipes to this day'} variant="tinted" icon={adding ? 'checkmark' : 'add'} onPress={() => setAdding(!adding)} />
      {adding && allRecipes().map((c) => {
        const on = (state.boxedPlan[day] ?? []).includes(c.recipe.id)
        return (
          <Card key={c.recipe.id} tight onPress={() => dispatch({ type: 'toggleBoxed', date: day, mealId: c.recipe.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: on ? C.gold : 'transparent' }}>
            <IconTile emoji={c.recipe.emoji} size={40} bg={C.fill} />
            <View style={{ flex: 1 }}><Text style={T.headline} numberOfLines={1}>{c.recipe.title}</Text><Text style={T.caption}>{fmt.kcal(c.perServing.kcal)} kcal · {fmt.g(c.perServing.protein)} g protein · {c.minutes} min</Text></View>
            <Icon name={on ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={C.accent} />
          </Card>
        )
      })}
    </View>
  )
}

/** Supermarket section from the CoFID food group (first number of the code) */
const AISLE_OF: Record<string, string> = { '11': 'Bread, rice & pasta', '12': 'Dairy & eggs', '13': 'Vegetables & pulses', '14': 'Fruit & nuts', '16': 'Fish', '17': 'Cupboard', '18': 'Meat & poultry', '19': 'Other' }
const AISLE_ICON: Record<string, string> = { 'Bread, rice & pasta': '🥖', 'Dairy & eggs': '🧀', 'Vegetables & pulses': '🥬', 'Fruit & nuts': '🍎', Fish: '🐟', Cupboard: '🫙', 'Meat & poultry': '🥩', Other: '🛒' }

function Ingredients() {
  const { state } = useStore()
  const [range, setRange] = useState<'day' | 'week'>('week')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const groups = useMemo(() => {
    const days = range === 'day' ? [todayKey()] : Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i))
    const map = new Map<string, { key: string; label: string; grams: number; aisle: string }>()
    for (const d of days) for (const id of state.boxedPlan[d] ?? []) {
      const c = recipeById(id)
      if (!c) continue
      for (const ing of c.ingredients) {
        const key = ing.food.id
        const grams = ing.grams / c.recipe.servings // one serving of each planned recipe
        const cur = map.get(key)
        map.set(key, cur ? { ...cur, grams: cur.grams + grams } : { key, label: ing.label, grams, aisle: AISLE_OF[key.split('-')[1]] ?? 'Other' })
      }
    }
    const byAisle: Record<string, { key: string; label: string; grams: number }[]> = {}
    for (const i of map.values()) (byAisle[i.aisle] ??= []).push(i)
    return Object.entries(byAisle).sort(([a], [b]) => a.localeCompare(b))
  }, [state.boxedPlan, range])

  const count = groups.reduce((a, [, l]) => a + l.length, 0)
  const done = Object.values(checked).filter(Boolean).length

  return (
    <View style={{ gap: 12 }}>
      <Segmented value={range} onChange={setRange} options={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'Next 7 days' }]} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="basket" color={C.goldLight} bg={C.ink} size={44} />
        <View style={{ flex: 1 }}><Text style={T.title3}>Shopping list</Text><Text style={T.sub}>{count ? `${done} of ${count} items collected` : 'Plan recipes to build your list'}</Text></View>
      </Card>
      {count === 0 && <Button title="Plan recipes" variant="tinted" onPress={() => router.setParams({ tab: 'plan' })} />}
      {groups.map(([aisle, items]) => (
        <View key={aisle} style={{ gap: 8 }}>
          <Text style={[T.eyebrow, { marginLeft: 4, marginTop: 6 }]}>{AISLE_ICON[aisle]} {aisle}</Text>
          <Card style={{ padding: 0 }}>
            {items.map((i, idx) => (
              <Pressable key={i.key} onPress={() => { tap(); setChecked({ ...checked, [i.key]: !checked[i.key] }) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: idx ? 1 : 0, borderTopColor: C.sep }}>
                <Icon name={checked[i.key] ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={checked[i.key] ? C.ink : C.text3} />
                <Text style={[T.body, { flex: 1, fontWeight: '600' }, checked[i.key] && { color: C.text3, textDecorationLine: 'line-through' }]}>{i.label}</Text>
                <Text style={[T.sub, T.num]}>{fmt.g0(i.grams)} g</Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      {count > 0 && <Text style={[T.caption, { lineHeight: 16 }]}>Quantities cover one serving of each planned recipe, using the weights in each recipe (raw or cooked as noted there).</Text>}
    </View>
  )
}

function WaterPlan() {
  const { state, dispatch } = useStore()
  const p = state.waterPlan
  const ml = state.water[todayKey()] ?? 0
  const glasses = Math.ceil(state.targets.waterMl / p.glassMl)
  const span = Math.max(1, p.endHour - p.startHour)
  const slots = Array.from({ length: glasses }, (_, i) => {
    const h = p.startHour + (span * i) / Math.max(1, glasses - 1)
    return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
  })
  const doneCount = Math.floor(ml / p.glassMl)
  const nowH = new Date().getHours() + new Date().getMinutes() / 60

  return (
    <View style={{ gap: 12 }}>
      <WaterCard date={todayKey()} />
      <Card style={{ gap: 14 }}>
        <Text style={T.title3}>Schedule</Text>
        {([['Start', 'startHour', ':00'], ['Finish', 'endHour', ':00'], ['Glass size', 'glassMl', 'ml']] as const).map(([l, k, suf]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={T.headline}>{l}</Text>
            <Stepper value={p[k]} step={k === 'glassMl' ? 50 : 1} min={k === 'glassMl' ? 100 : 0} suffix={suf}
              onChange={(v) => dispatch({ type: 'waterPlan', plan: { ...p, [k]: k === 'glassMl' ? v : Math.min(23, v) } })} />
          </View>
        ))}
      </Card>
      <Card style={{ padding: 0 }}>
        {slots.map((time, i) => {
          const done = i < doneCount
          const [hh, mm] = time.split(':').map(Number)
          const due = !done && hh + mm / 60 <= nowH
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }}>
              <Icon name={done ? 'water' : 'water-outline'} size={22} color={done ? C.accent : due ? C.orange : C.text3} />
              <Text style={[T.headline, T.num, { width: 56 }]}>{time}</Text>
              <Text style={[T.sub, { flex: 1 }]}>Glass {i + 1} · {p.glassMl} ml</Text>
              {done ? <Pill>Done</Pill> : due ? <Pill color={C.orange} bg="#F8EBD8">Due</Pill> : null}
            </View>
          )
        })}
      </Card>
    </View>
  )
}
