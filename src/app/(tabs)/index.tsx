import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../../lib/store'
import { dayTotals, fmt, remainingOf } from '../../lib/nutrition'
import { allRecipes, fitFor } from '../../lib/recipes'
import { logStreak, workoutsThisWeek } from '../../lib/progress'
import { lastNDays, prettyDate, todayKey, uid, weekdayShort } from '../../lib/date'
import { mealLabel, useMeals } from '../../lib/meals'
import { C, F, T } from '../../theme'
import { Bar, Card, FadeIn, Icon, IconTile, Pill, Ring, Screen, SectionHeader, success, tap, type IconName } from '../../components/ui'
import { RecipeRow } from '../../components/RecipeRow'

/** Home: food first — your numbers, quick logging, meals that fit, recent meals; fitness & community after. */
export default function Home() {
  const { state, dispatch } = useStore()
  const meals = useMeals()
  const [date, setDate] = useState(todayKey())
  const t = state.targets
  const day = dayTotals(state.food, date)
  const m = day.total
  const left = remainingOf(t, m)
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const isToday = date === todayKey()

  const suggestions = allRecipes().map((c) => ({ c, fit: fitFor(c.perServing, left) })).sort((a, b) => b.fit.score - a.fit.score).slice(0, 3)
  // recent distinct meals from earlier days, newest first — one tap to log again today
  const seen = new Set<string>()
  const recent = [...state.food].filter((f) => f.date !== todayKey()).reverse().filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true))).slice(0, 4)

  const LOG: [IconName, string, () => void][] = [
    ['search', 'Search', () => router.push('/add-food')],
    ['barcode-outline', 'Barcode', () => router.push({ pathname: '/scanner', params: { mode: 'barcode' } })],
    ['camera-outline', 'Photo', () => router.push('/food-photo')],
    ['bookmark-outline', 'Saved', () => router.push({ pathname: '/add-food', params: { mode: 'meals' } })],
  ]

  return (
    <Screen
      eyebrow={`${greet} · ${prettyDate(date)}`}
      title={isToday ? 'Today' : prettyDate(date).split(',')[0]}
      right={<Pressable onPress={() => { tap(); router.push('/profile') }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Profile"><Text style={{ color: C.skyLight, fontFamily: F.hand, fontSize: 24 }}>{state.profile.name[0]?.toUpperCase()}</Text></Pressable>}
    >
      {state.demo && <View style={{ marginTop: -6, marginBottom: 10 }}><Pill color={C.accent} bg={C.accentSoft}>Demo data — remove in Profile</Pill></View>}

      {/* Week strip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        {lastNDays(7).map((d) => {
          const on = d === date
          const logged = state.food.some((f) => f.date === d)
          return (
            <Pressable key={d} onPress={() => { tap(); setDate(d) }} style={{ alignItems: 'center', gap: 6, width: 42, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? C.card : 'transparent' }}>
              <Text style={[T.caption, on && { color: C.text }]}>{weekdayShort(d)}</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: logged ? 'solid' : 'dashed', borderColor: on ? C.night : logged ? C.sky : C.accentLine, backgroundColor: on ? C.night : 'transparent' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: on ? C.skyLight : C.text }}>{+d.slice(8)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <FadeIn>
        {/* 1. Calories and macros */}
        <Card onPress={() => router.navigate('/food')} style={{ padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={T.bigNum}>{fmt.kcal(Math.abs(left.kcal)).toLocaleString()}</Text>
              <Text style={[T.headline, { color: C.text2 }]}>{left.kcal >= 0 ? 'calories remaining' : 'calories over'}</Text>
              <Text style={[T.caption, { marginTop: 6 }]}>{fmt.kcal(m.kcal)} eaten of {t.kcal.toLocaleString()} kcal</Text>
            </View>
            <Ring value={m.kcal} max={t.kcal} size={108} stroke={10} color={left.kcal < 0 ? C.orange : C.sky}>
              <Icon name="flame" size={26} color={C.accent} />
            </Ring>
          </View>
          <View style={{ gap: 10 }}>
            {([['Protein', m.protein, t.protein, C.protein], ['Carbs', m.carbs, t.carbs, C.carbs], ['Fat', m.fat, t.fat, C.fat]] as const).map(([l, v, max, c]) => (
              <View key={l} style={{ gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={T.headline}>{l}</Text>
                  <Text style={[T.sub, T.num]}><Text style={{ color: C.text, fontWeight: '700' }}>{fmt.g(v)}</Text> / {max} g · {fmt.g(Math.max(0, max - v))} g left</Text>
                </View>
                <Bar pct={v / max} color={c} height={7} />
              </View>
            ))}
          </View>
        </Card>

        {/* 2. Log food */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {LOG.map(([icon, label, fn]) => (
            <Card key={label} tight onPress={fn} style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14 }}>
              <IconTile icon={icon} size={36} color={C.skyLight} bg={C.night} />
              <Text style={[T.caption, { color: C.text, fontWeight: '600' }]}>{label}</Text>
            </Card>
          ))}
        </View>
      </FadeIn>

      {/* 3. Meals that fit your day */}
      <SectionHeader title="Meals that fit your day" action="All recipes" onAction={() => router.navigate('/recipes')} />
      <Text style={[T.caption, { marginLeft: 4, marginTop: -4, marginBottom: 10 }]}>Ranked for your remaining {fmt.kcal(Math.max(0, left.kcal))} kcal and {fmt.g(Math.max(0, left.protein))} g protein</Text>
      <View style={{ gap: 10 }}>
        {suggestions.map(({ c, fit }) => <RecipeRow key={c.recipe.id} c={c} reason={fit.reasons[0]} />)}
      </View>

      {/* 4. Recent meals */}
      {recent.length > 0 && (
        <>
          <SectionHeader title="Eat it again" />
          <View style={{ gap: 10 }}>
            {recent.map((f) => (
              <Card key={f.id} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile emoji={f.emoji ?? '🍽️'} size={44} bg={C.fill} />
                <View style={{ flex: 1 }}>
                  <Text style={T.headline} numberOfLines={1}>{f.name}</Text>
                  <Text style={T.sub}>{fmt.kcal(f.kcal)} kcal · {fmt.g(f.protein)} g protein · {mealLabel(f.meal, meals)}</Text>
                </View>
                <Pressable accessibilityLabel={`Log ${f.name} again today`} hitSlop={8} onPress={() => { dispatch({ type: 'addFood', entry: { ...f, id: uid(), date: todayKey(), demo: undefined } }); success() }}>
                  <Icon name="add-circle" size={28} color={C.accent} />
                </Pressable>
              </Card>
            ))}
          </View>
        </>
      )}

      {/* 5. Supporting: fitness and community */}
      <SectionHeader title="Also today" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card tight onPress={() => router.navigate('/fitness')} style={{ flex: 1, gap: 4 }}>
          <Icon name="barbell-outline" color={C.accent} />
          <Text style={T.title3}>{workoutsThisWeek(state)} workouts</Text>
          <Text style={T.caption}>this week · 🔥 {logStreak(state)}-day log streak</Text>
        </Card>
        <Card tight onPress={() => router.navigate('/social')} style={{ flex: 1, gap: 4 }}>
          <Icon name="people-outline" color={C.accent} />
          <Text style={T.title3}>Gym buddies</Text>
          <Text style={T.caption}>Find training partners (18+)</Text>
        </Card>
      </View>
      <Card tight onPress={() => router.navigate('/food')} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="water-outline" color={C.accent} />
        <View style={{ flex: 1 }}><Text style={T.headline}>Water</Text><Text style={T.caption}>{((state.water[date] ?? 0) / 1000).toFixed(2)} of {(t.waterMl / 1000).toFixed(1)} L</Text></View>
        <View style={{ width: 90 }}><Bar pct={(state.water[date] ?? 0) / t.waterMl} color={C.water} /></View>
      </Card>
    </Screen>
  )
}
