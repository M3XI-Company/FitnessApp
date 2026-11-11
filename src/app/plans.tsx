import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useStore } from '../lib/store'
import { BOXED_MEALS, boxedById, type BoxedMeal, type Ingredient } from '../data/boxedMeals'
import { MEALS } from '../lib/meals'
import { addDays, todayKey, uid, weekdayShort } from '../lib/date'
import { sumMacros } from '../lib/nutrition'
import { C, T } from '../theme'
import { Bar, Button, Card, Icon, IconTile, Pill, Segmented, SheetHeader, Stepper, success, tap } from '../components/ui'
import { WaterCard } from '../components/WaterCard'

type Tab = 'boxed' | 'ingredients' | 'water'

export default function Plans() {
  const params = useLocalSearchParams<{ tab?: Tab }>()
  const [tab, setTab] = useState<Tab>(params.tab ?? 'boxed')
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Plans" onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'boxed', label: 'Boxed meals' }, { value: 'ingredients', label: 'Ingredients' }, { value: 'water', label: 'Water plan' }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tab === 'boxed' && <Boxed />}
        {tab === 'ingredients' && <Ingredients />}
        {tab === 'water' && <WaterPlan />}
      </ScrollView>
    </View>
  )
}

function Boxed() {
  const { state, dispatch } = useStore()
  const [day, setDay] = useState(todayKey())
  const [open, setOpen] = useState<string | null>(null)
  const planned = (state.boxedPlan[day] ?? []).map(boxedById).filter(Boolean) as BoxedMeal[]
  const total = sumMacros(planned)
  const t = state.targets

  const log = (b: BoxedMeal) => {
    dispatch({ type: 'addFood', entry: { id: uid(), date: todayKey(), meal: b.slot, name: b.name, serving: '1 box', qty: 1, emoji: b.emoji, kcal: b.kcal, protein: b.protein, carbs: b.carbs, fat: b.fat, source: 'boxed' } })
    if (b.waterMl) dispatch({ type: 'water', date: todayKey(), delta: b.waterMl })
    success()
  }

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i)).map((d) => (
          <Pressable key={d} onPress={() => { tap(); setDay(d) }} style={{ width: 48, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 4, backgroundColor: d === day ? C.blue : C.card }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: d === day ? 'rgba(255,255,255,.8)' : C.text3 }}>{weekdayShort(d)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: d === day ? '#fff' : C.text }}>{+d.slice(8)}</Text>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: (state.boxedPlan[d] ?? []).length ? (d === day ? '#fff' : C.blue) : 'transparent' }} />
          </Pressable>
        ))}
      </ScrollView>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={T.title3}>{planned.length} box{planned.length === 1 ? '' : 'es'} planned</Text>
          <Text style={[T.sub, T.num]}>{total.kcal} / {t.kcal} kcal</Text>
        </View>
        <View style={{ marginTop: 10 }}><Bar pct={total.kcal / t.kcal} /></View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
          {([['Protein', total.protein, t.protein], ['Carbs', total.carbs, t.carbs], ['Fat', total.fat, t.fat]] as const).map(([l, v, m]) => (
            <Text key={l} style={T.sub}><Text style={{ color: C.text, fontWeight: '700' }}>{v}</Text>/{m}g {l.toLowerCase()}</Text>
          ))}
        </View>
      </Card>

      {MEALS.map((slot) => (
        <View key={slot.slot} style={{ gap: 10 }}>
          <Text style={[T.eyebrow, { marginTop: 10, marginLeft: 4 }]}>{slot.label}</Text>
          {BOXED_MEALS.filter((b) => b.slot === slot.slot).map((b) => {
            const inPlan = planned.some((p) => p.id === b.id)
            const expanded = open === b.id
            return (
              <Card key={b.id} style={{ padding: 0, overflow: 'hidden', borderWidth: 2, borderColor: inPlan ? C.blue : 'transparent' }}>
                <Pressable onPress={() => { tap(); setOpen(expanded ? null : b.id) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                  <IconTile emoji={b.emoji} size={52} bg={C.fill} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={T.headline} numberOfLines={2}>{b.name}</Text>
                    <Text style={T.sub}>{b.kcal} kcal · {b.protein}P · {b.carbs}C · {b.fat}F</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>{b.tags.slice(0, 2).map((tg) => <Pill key={tg}>{tg}</Pill>)}<Pill color={C.text2} bg={C.fill}>{`${b.minutes} min`}</Pill></View>
                  </View>
                  <Pressable hitSlop={8} onPress={() => { tap(); dispatch({ type: 'toggleBoxed', date: day, mealId: b.id }) }} accessibilityLabel={inPlan ? 'Remove from plan' : 'Add to plan'}>
                    <Icon name={inPlan ? 'checkmark-circle' : 'add-circle-outline'} size={30} color={C.blue} />
                  </Pressable>
                </Pressable>
                {expanded && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12, borderTopWidth: 1, borderTopColor: C.sep, paddingTop: 14 }}>
                    <Text style={T.eyebrow}>Ingredients</Text>
                    {b.ingredients.map((i) => (
                      <View key={i.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={T.body}>{i.name}</Text><Text style={[T.sub, T.num]}>{i.qty} {i.unit}</Text></View>
                    ))}
                    <Text style={[T.eyebrow, { marginTop: 4 }]}>Steps</Text>
                    {b.steps.map((s, i) => <Text key={i} style={T.body}><Text style={{ color: C.blue, fontWeight: '700' }}>{i + 1}. </Text>{s}</Text>)}
                    {b.waterMl > 0 && <Text style={T.sub}>💧 Contributes ~{b.waterMl} ml to your water goal</Text>}
                    <Button title="Log this meal now" icon="checkmark" variant="tinted" onPress={() => log(b)} />
                  </View>
                )}
              </Card>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function Ingredients() {
  const { state } = useStore()
  const [range, setRange] = useState<'day' | 'week'>('week')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const groups = useMemo(() => {
    const days = range === 'day' ? [todayKey()] : Array.from({ length: 7 }, (_, i) => addDays(todayKey(), i))
    const map = new Map<string, Ingredient & { meals: number }>()
    for (const d of days) for (const id of state.boxedPlan[d] ?? []) {
      for (const ing of boxedById(id)?.ingredients ?? []) {
        const key = `${ing.name}|${ing.unit}`
        const cur = map.get(key)
        map.set(key, cur ? { ...cur, qty: cur.qty + ing.qty, meals: cur.meals + 1 } : { ...ing, meals: 1 })
      }
    }
    const byAisle: Record<string, (Ingredient & { meals: number })[]> = {}
    for (const i of map.values()) (byAisle[i.aisle] ??= []).push(i)
    return Object.entries(byAisle).sort(([a], [b]) => a.localeCompare(b))
  }, [state.boxedPlan, range])

  const count = groups.reduce((a, [, l]) => a + l.length, 0)
  const done = Object.values(checked).filter(Boolean).length
  const AISLE: Record<string, string> = { Produce: '🥬', Protein: '🥩', Dairy: '🧀', Pantry: '🫙', Bakery: '🥖', Frozen: '🧊' }

  return (
    <View style={{ gap: 12 }}>
      <Segmented value={range} onChange={setRange} options={[{ value: 'day', label: 'Today' }, { value: 'week', label: 'Next 7 days' }]} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile icon="basket" color="#fff" bg={C.blue} size={44} />
        <View style={{ flex: 1 }}><Text style={T.title3}>Shopping list</Text><Text style={T.sub}>{count ? `${done} of ${count} items collected` : 'Plan boxed meals to build your list'}</Text></View>
      </Card>
      {count === 0 && <Button title="Plan boxed meals" variant="tinted" onPress={() => router.setParams({ tab: 'boxed' })} />}
      {groups.map(([aisle, items]) => (
        <View key={aisle} style={{ gap: 8 }}>
          <Text style={[T.eyebrow, { marginLeft: 4, marginTop: 6 }]}>{AISLE[aisle]} {aisle}</Text>
          <Card style={{ padding: 0 }}>
            {items.map((i, idx) => {
              const k = `${i.name}|${i.unit}`
              return (
                <Pressable key={k} onPress={() => { tap(); setChecked({ ...checked, [k]: !checked[k] }) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: idx ? 1 : 0, borderTopColor: C.sep }}>
                  <Icon name={checked[k] ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={checked[k] ? C.blue : C.text3} />
                  <Text style={[T.body, { flex: 1, fontWeight: '600' }, checked[k] && { color: C.text3, textDecorationLine: 'line-through' }]}>{i.name}</Text>
                  <Text style={[T.sub, T.num]}>{+i.qty.toFixed(1)} {i.unit}</Text>
                </Pressable>
              )
            })}
          </Card>
        </View>
      ))}
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
  const plannedFood = (state.boxedPlan[todayKey()] ?? []).reduce((a, id) => a + (boxedById(id)?.waterMl ?? 0), 0)

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
        {plannedFood > 0 && <Text style={T.sub}>💧 Your boxed meals today add ~{plannedFood} ml of water from food.</Text>}
      </Card>
      <Card style={{ padding: 0 }}>
        {slots.map((time, i) => {
          const done = i < doneCount
          const [hh, mm] = time.split(':').map(Number)
          const due = !done && hh + mm / 60 <= nowH
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }}>
              <Icon name={done ? 'water' : 'water-outline'} size={22} color={done ? C.blue : due ? C.orange : C.text3} />
              <Text style={[T.headline, T.num, { width: 56 }]}>{time}</Text>
              <Text style={[T.sub, { flex: 1 }]}>Glass {i + 1} · {p.glassMl} ml</Text>
              {done ? <Pill>Done</Pill> : due ? <Pill color={C.orange} bg="#FFF4E0">Due</Pill> : null}
            </View>
          )
        })}
      </Card>
    </View>
  )
}
