import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { dayMacros, goalProgress, levelName, logStreak, workoutsThisWeek, xp } from '../../lib/progress'
import { lastNDays, prettyDate, todayKey, weekdayShort } from '../../lib/date'
import { round } from '../../lib/nutrition'
import { C, T, blueGlow } from '../../theme'
import { Bar, Card, FadeIn, Icon, IconButton, IconTile, Ring, Screen, SectionHeader, tap } from '../../components/ui'
import { WaterCard } from '../../components/WaterCard'

export default function Today() {
  const { state } = useStore()
  const [date, setDate] = useState(todayKey())
  const t = state.targets
  const m = dayMacros(state, date)
  const left = Math.round(t.kcal - m.kcal)
  const level = xp(state)
  const streak = logStreak(state)
  const recent = state.food.filter((f) => f.date === date).slice(-3).reverse()
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <Screen
      eyebrow={`${greet} · ${prettyDate(date)}`}
      title={date === todayKey() ? 'Today' : prettyDate(date).split(',')[0]}
      right={<Pressable onPress={() => { tap(); router.push('/profile') }} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{state.profile.name[0]?.toUpperCase()}</Text></Pressable>}
    >
      {/* Week strip */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        {lastNDays(7).map((d) => {
          const on = d === date
          const logged = state.food.some((f) => f.date === d)
          return (
            <Pressable key={d} onPress={() => { tap(); setDate(d) }} style={{ alignItems: 'center', gap: 6, width: 42, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? C.card : 'transparent' }}>
              <Text style={[T.caption, on && { color: C.text }]}>{weekdayShort(d)}</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: logged ? 'solid' : 'dashed', borderColor: on ? C.blue : logged ? C.blue100 : '#CBD3E0', backgroundColor: on ? C.blue : 'transparent' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : C.text }}>{+d.slice(8)}</Text>
              </View>
            </Pressable>
          )
        })}
      </View>

      <FadeIn>
        {/* Calories hero */}
        <Card onPress={() => router.navigate('/food')} style={{ flexDirection: 'row', alignItems: 'center', padding: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: 46, fontWeight: '800', letterSpacing: -1.5, color: C.text }, T.num]}>{Math.abs(left).toLocaleString()}</Text>
            <Text style={[T.headline, { color: C.text2 }]}>{left >= 0 ? 'Calories left' : 'Calories over'}</Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 14 }}>
              <View><Text style={T.caption}>Eaten</Text><Text style={[T.headline, T.num]}>{round(m.kcal)}</Text></View>
              <View><Text style={T.caption}>Goal</Text><Text style={[T.headline, T.num]}>{t.kcal}</Text></View>
            </View>
          </View>
          <Ring value={m.kcal} max={t.kcal} size={118} stroke={11} color={left < 0 ? C.orange : C.blue}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue50, alignItems: 'center', justifyContent: 'center' }}><Icon name="flame" size={28} color={C.blue} /></View>
          </Ring>
        </Card>

        {/* Macros */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {([['Protein', m.protein, t.protein, C.protein, 'fish'], ['Carbs', m.carbs, t.carbs, C.carbs, 'leaf'], ['Fat', m.fat, t.fat, C.fat, 'water']] as const).map(([label, v, max, color, icon]) => (
            <Card key={label} tight style={{ flex: 1, alignItems: 'flex-start' }}>
              <Text style={[T.title3, T.num]}>{Math.max(0, Math.round(max - v))}g</Text>
              <Text style={T.caption}>{label} left</Text>
              <View style={{ alignSelf: 'center', marginTop: 12 }}>
                <Ring value={v} max={max} size={64} stroke={7} color={color}><Icon name={icon} size={18} color={color} /></Ring>
              </View>
            </Card>
          ))}
        </View>
      </FadeIn>

      {/* Water */}
      <SectionHeader title="Water" action="Plan" onAction={() => router.push({ pathname: '/plans', params: { tab: 'water' } })} />
      <WaterCard date={date} />

      {/* Level / streak */}
      <SectionHeader title="Progress" action="Goals" onAction={() => router.push('/profile')} />
      <Pressable onPress={() => { tap(); router.push('/profile') }}>
        <LinearGradient colors={['#2A86FF', '#0A6CFF', '#0040C0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 22, padding: 18 }, blueGlow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>LEVEL {level.level}</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{levelName(level.level)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>🔥 {streak}</Text><Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, fontWeight: '600' }}>day streak</Text></View>
              <View style={{ alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{workoutsThisWeek(state)}</Text><Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 11, fontWeight: '600' }}>workouts</Text></View>
            </View>
          </View>
          <View style={{ marginTop: 14 }}><Bar pct={level.into / level.span} color="#fff" track="rgba(255,255,255,.22)" /></View>
          <Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: '600', marginTop: 6 }}>{level.into} / {level.span} XP to level {level.level + 1}</Text>
        </LinearGradient>
      </Pressable>
      <View style={{ gap: 10, marginTop: 12 }}>
        {state.goals.slice(0, 2).map((g) => {
          const p = goalProgress(state, g.metric, g.target)
          return (
            <Card key={g.id} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon={p.pct >= 1 ? 'checkmark' : 'flag'} color={p.pct >= 1 ? '#fff' : C.blue} bg={p.pct >= 1 ? C.green : C.blue50} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={T.headline}>{g.title}</Text><Text style={[T.sub, T.num]}>{Math.min(100, Math.round(p.pct * 100))}%</Text></View>
                <Bar pct={p.pct} color={p.pct >= 1 ? C.green : C.blue} height={6} />
              </View>
            </Card>
          )
        })}
      </View>

      {/* Shortcuts */}
      <SectionHeader title="Shortcuts" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {([
          ['barcode-outline', 'Scan barcode', 'Instant nutrition', () => router.push({ pathname: '/scanner', params: { mode: 'barcode' } })],
          ['scan-outline', 'Product scanner', 'Health grade', () => router.push({ pathname: '/scanner', params: { mode: 'product' } })],
          ['cube-outline', 'Boxed meals', 'Plan your day', () => router.push({ pathname: '/plans', params: { tab: 'boxed' } })],
          ['basket-outline', 'Ingredients', 'Shopping list', () => router.push({ pathname: '/plans', params: { tab: 'ingredients' } })],
        ] as const).map(([icon, title, sub, fn]) => (
          <Card key={title} tight onPress={fn} style={{ width: '48.5%', gap: 10 }}>
            <IconTile icon={icon} />
            <View><Text style={T.headline}>{title}</Text><Text style={T.sub}>{sub}</Text></View>
          </Card>
        ))}
      </View>

      {/* Recently logged */}
      <SectionHeader title="Recently logged" action="See all" onAction={() => router.navigate('/food')} />
      {recent.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <Text style={T.sub}>Nothing logged yet for this day.</Text>
          <IconButton icon="add" variant="blue" onPress={() => router.push('/add-food')} label="Add food" />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {recent.map((f) => (
            <Card key={f.id} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile emoji={f.emoji ?? '🍽️'} size={48} bg={C.fill} />
              <View style={{ flex: 1 }}>
                <Text style={T.headline} numberOfLines={1}>{f.name}</Text>
                <Text style={T.sub}><Text style={{ color: C.text, fontWeight: '700' }}>{Math.round(f.kcal)}</Text> kcal · {round(f.protein)}P · {round(f.carbs)}C · {round(f.fat)}F</Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  )
}
