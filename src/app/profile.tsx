import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../lib/store'
import { exerciseHistory, goalProgress, levelName, LEVEL_NAMES, logStreak, waterDaysStreak, workoutDates, xp } from '../lib/progress'
import { todayKey, uid } from '../lib/date'
import type { UserGoal } from '../lib/types'
import { C, T, glow, G, F } from '../theme'
import { Bar, Button, Card, Icon, IconTile, List, Row, SectionHeader, SheetHeader, tap } from '../components/ui'

const PRESETS: Omit<UserGoal, 'id' | 'createdAt'>[] = [
  { title: 'Train 3× this week', metric: 'workouts_week', target: 3 },
  { title: 'Train 5× this week', metric: 'workouts_week', target: 5 },
  { title: 'Hit protein 7 days', metric: 'protein_days', target: 7 },
  { title: 'Log food 14 days straight', metric: 'log_streak', target: 14 },
  { title: 'Hydrate 3 days in a row', metric: 'water_days', target: 3 },
]

export default function Profile() {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const lv = xp(state)
  const p = state.profile
  const t = state.targets

  const benchBest = Math.max(0, ...exerciseHistory(state, 'bench').map((h) => h.value))
  const achievements = [
    { e: '🔥', t: 'On fire', d: '7-day log streak', ok: logStreak(state) >= 7 },
    { e: '🏋️', t: 'Regular', d: '10 workouts', ok: workoutDates(state).length >= 10 },
    { e: '💧', t: 'Hydrated', d: 'Water goal 3 days', ok: waterDaysStreak(state) >= 3 },
    { e: '📸', t: 'Scanner', d: 'Scan a barcode', ok: state.food.some((f) => f.source === 'barcode' || f.source === 'scan') },
    { e: '🍱', t: 'Meal prepper', d: 'Log a boxed meal', ok: state.food.some((f) => f.source === 'boxed') },
    { e: '🦍', t: 'Bench 100', d: '100 kg e1RM bench', ok: benchBest >= 100 },
    { e: '🤝', t: 'Teammate', d: 'Connect a buddy', ok: state.buddies.length > 0 },
    { e: '⭐', t: 'Level 5', d: 'Reach level 5', ok: lv.level >= 5 },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Profile & Goals" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        <LinearGradient colors={G.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 24, padding: 20 }, glow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 24 }}>{p.name[0]?.toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.cloud, fontSize: 32, fontFamily: F.hand, lineHeight: 34 }}>{p.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,.8)', fontWeight: '600' }}>Level {lv.level} · {levelName(lv.level)} · {lv.total} XP</Text>
            </View>
          </View>
          <View style={{ marginTop: 16 }}><Bar pct={lv.into / lv.span} color={C.sky} track="rgba(255,255,255,.14)" /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: '600' }}>{lv.span - lv.into} XP to level {lv.level + 1}</Text>
            <Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 12, fontWeight: '600' }}>Next rank: {LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor(lv.level / 2))]}</Text>
          </View>
        </LinearGradient>
        <Text style={[T.caption, { marginTop: 8, marginLeft: 4 }]}>Earn XP: meal +5 · set +3 · workout +25 · glass of water +2</Text>

        <SectionHeader title="Goals" action={adding ? 'Done' : 'Add'} onAction={() => setAdding(!adding)} />
        {adding && (
          <Card style={{ gap: 8, marginBottom: 12 }}>
            {PRESETS.filter((x) => !state.goals.some((g) => g.title === x.title)).map((x) => (
              <Pressable key={x.title} onPress={() => { tap(); dispatch({ type: 'addGoal', goal: { ...x, id: uid(), createdAt: todayKey() } }) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
                <Icon name="add-circle" color={C.accent} size={24} /><Text style={T.headline}>{x.title}</Text>
              </Pressable>
            ))}
          </Card>
        )}
        <View style={{ gap: 10 }}>
          {state.goals.map((g) => {
            const pr = goalProgress(state, g.metric, g.target)
            const done = pr.pct >= 1
            return (
              <Card key={g.id} tight style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon={done ? 'trophy' : 'flag'} color={done ? '#fff' : C.accent} bg={done ? C.green : C.accentSoft} />
                  <View style={{ flex: 1 }}>
                    <Text style={T.headline}>{g.title}</Text>
                    <Text style={T.sub}>{g.metric === 'weight' ? `${pr.value} kg → ${g.target} kg` : `${pr.value} / ${g.target}`}</Text>
                  </View>
                  {adding ? (
                    <Pressable onPress={() => dispatch({ type: 'removeGoal', id: g.id })} hitSlop={8} accessibilityLabel="Remove goal"><Icon name="remove-circle" color={C.red} size={24} /></Pressable>
                  ) : <Text style={[T.headline, { color: done ? C.green : C.accent }]}>{Math.min(100, Math.round(pr.pct * 100))}%</Text>}
                </View>
                <Bar pct={pr.pct} color={done ? C.green : C.accent} height={6} />
              </Card>
            )
          })}
        </View>

        <SectionHeader title="Achievements" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {achievements.map((a) => (
            <View key={a.t} style={{ width: '23%', alignItems: 'center', gap: 4, opacity: a.ok ? 1 : 0.35 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: a.ok ? C.accentSoft : C.fill2, alignItems: 'center', justifyContent: 'center', borderWidth: a.ok ? 2 : 0, borderColor: C.accent }}><Text style={{ fontSize: 28 }}>{a.e}</Text></View>
              <Text style={[T.caption, { color: C.text, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1}>{a.t}</Text>
              <Text style={[T.caption, { fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>{a.d}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Daily targets" action="Edit" onAction={() => router.push('/targets')} />
        <List>
          <Row first left={<IconTile icon="flame" />} title="Calories" right={<Text style={T.headline}>{t.kcal} kcal</Text>} />
          <Row left={<IconTile icon="fish" />} title="Protein" right={<Text style={T.headline}>{t.protein} g</Text>} />
          <Row left={<IconTile icon="leaf" />} title="Carbs" right={<Text style={T.headline}>{t.carbs} g</Text>} />
          <Row left={<IconTile icon="water-outline" />} title="Fat" right={<Text style={T.headline}>{t.fat} g</Text>} />
          <Row left={<IconTile icon="water" />} title="Water" right={<Text style={T.headline}>{(t.waterMl / 1000).toFixed(1)} L</Text>} />
        </List>

        <SectionHeader title="Profile" />
        <List>
          <Row first left={<IconTile icon="body" />} title="Body" subtitle={`${p.age} yrs · ${p.heightCm} cm · ${p.weightKg} kg`} />
          <Row left={<IconTile icon="trending-down" />} title="Goal" subtitle={`${p.goal === 'lose' ? 'Lose weight' : p.goal === 'gain' ? 'Build muscle' : 'Maintain'} · target ${p.targetWeightKg} kg`} />
          <Row left={<IconTile icon="create-outline" />} title="Edit plan" onPress={() => router.push('/onboarding')} right={<Icon name="chevron-forward" size={16} color={C.text3} />} />
          <Row left={<IconTile icon="scale-outline" />} title="Log weight" onPress={() => router.push('/weight')} right={<Icon name="chevron-forward" size={16} color={C.text3} />} />
          <Row left={<IconTile icon="document-text-outline" />} title="Data sources & licences" onPress={() => router.push('/licences')} right={<Icon name="chevron-forward" size={16} color={C.text3} />} />
        </List>

        <SectionHeader title="Privacy & safety" />
        <List>
          <Row first left={<IconTile icon="videocam-outline" />} title="Camera form check"
            subtitle={p.formConsentAt ? 'Allowed · processed on this phone, never recorded' : 'Not allowed'}
            right={p.formConsentAt ? <Button small variant="ghost" title="Withdraw" onPress={() => dispatch({ type: 'profile', profile: { ...p, formConsentAt: undefined } })} /> : undefined} />
          <Row left={<IconTile icon="shield-checkmark-outline" />} title="Gym buddy safety guidelines"
            subtitle={state.buddySafetyAt ? 'Accepted' : 'Shown before you see buddies'} />
          <Row left={<IconTile icon="ban-outline" />} title="Blocked people" subtitle={`${state.blocked.length} blocked · ${state.reports.length} reports sent`} />
        </List>

        <SectionHeader title="Demo data" />
        <Card style={{ gap: 10 }}>
          <Text style={[T.body, { lineHeight: 21 }]}>{state.demo
            ? 'Sample history is loaded so you can explore Breeze: two weeks of meals, workouts, weight and water. It’s marked as demo data and can be removed without touching anything you logged.'
            : 'No demo data. Everything in your diary was logged by you.'}</Text>
          <Button small variant={state.demo ? 'ghost' : 'tinted'} icon={state.demo ? 'trash-outline' : 'sparkles-outline'} title={state.demo ? 'Remove demo data' : 'Load demo data'} onPress={() => dispatch({ type: 'demo', on: !state.demo })} />
        </Card>
      </ScrollView>
    </View>
  )
}
