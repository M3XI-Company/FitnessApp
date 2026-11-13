import { useState } from 'react'
import { Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { AITrainer } from '../../components/coach/AITrainer'
import { useStore } from '../../lib/store'
import { EQUIPMENT, EXERCISES, MUSCLES, MUSCLE_COLOR, type Equipment, type Muscle } from '../../data/exercises'
import { exerciseHistory, workoutDates, workoutsThisWeek } from '../../lib/progress'
import { lastNDays, weekdayShort } from '../../lib/date'
import { round } from '../../lib/nutrition'
import { C, T } from '../../theme'
import { Bars, Button, Card, Chips, Icon, IconButton, LineChart, List, Pill, Row, Screen, SearchField, SectionHeader, Segmented } from '../../components/ui'

type Tab = 'library' | 'progress' | 'coach'

export default function Fitness() {
  const { q } = useLocalSearchParams<{ q?: string }>()
  const [picked, setTab] = useState<Tab>('library')
  // a question sent from elsewhere (e.g. Home) opens the AI trainer
  const tab: Tab = q ? 'coach' : picked
  const seg = <Segmented value={tab} onChange={setTab} options={[{ value: 'library', label: 'Exercises' }, { value: 'progress', label: 'Progress' }, { value: 'coach', label: 'AI trainer' }]} style={{ marginBottom: tab === 'coach' ? 8 : 14 }} />
  if (tab === 'coach') {
    return (
      <Screen title="Fitness" scroll={false}>
        <View style={{ paddingHorizontal: 16 }}>{seg}</View>
        <AITrainer />
      </Screen>
    )
  }
  return (
    <Screen title="Fitness" right={<IconButton icon="sparkles" variant="blue" onPress={() => router.setParams({ q: 'Build me a workout' })} label="AI workout" />}>
      {seg}
      {tab === 'library' ? <Library /> : <Progress />}
    </Screen>
  )
}

function Library() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<Muscle | 'All'>('All')
  const [equip, setEquip] = useState<Equipment | 'Any'>('Any')
  const list = EXERCISES.filter((e) => (muscle === 'All' || e.muscle === muscle) && (equip === 'Any' || e.equipment === equip) && e.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <View style={{ gap: 12 }}>
      <SearchField value={q} onChangeText={setQ} placeholder={`Search ${EXERCISES.length} exercises`} />
      <Chips value={muscle} onChange={setMuscle} items={[{ value: 'All', label: 'All' }, ...MUSCLES.map((m) => ({ value: m, label: m }))]} />
      <Chips value={equip} onChange={setEquip} items={[{ value: 'Any', label: 'Any equipment' }, ...EQUIPMENT.map((m) => ({ value: m, label: m }))]} />
      <Text style={[T.sub, { marginLeft: 4 }]}>{list.length} exercises</Text>
      <List>
        {list.map((e, i) => {
          const sets = state.sets.filter((x) => x.exerciseId === e.id)
          const best = sets.length ? Math.max(...sets.map((x) => x.weight)) : 0
          return (
            <Row key={e.id} first={i === 0} onPress={() => router.push(`/exercise/${e.id}`)}
              left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: MUSCLE_COLOR[e.muscle] + '1A', alignItems: 'center', justifyContent: 'center' }}><Icon name="barbell" size={20} color={MUSCLE_COLOR[e.muscle]} /></View>}
              title={e.name}
              subtitle={`${e.muscle} · ${e.equipment} · ${e.reps[0]}–${e.reps[1]} reps`}
              right={<View style={{ alignItems: 'flex-end', gap: 2 }}>{best ? <Text style={[T.headline, T.num]}>{best} kg</Text> : <Pill color={C.text2} bg={C.fill}>{e.level}</Pill>}<Icon name="chevron-forward" size={16} color={C.text3} /></View>} />
          )
        })}
      </List>
    </View>
  )
}

function Progress() {
  const { state } = useStore()
  const days = lastNDays(7)
  const volume = days.map((d) => ({ label: weekdayShort(d), value: state.sets.filter((s) => s.date === d).reduce((a, s) => a + s.weight * s.reps, 0) }))
  const lifts = [...new Set(state.sets.map((s) => s.exerciseId))]
    .map((id) => ({ id, name: EXERCISES.find((e) => e.id === id)?.name ?? id, h: exerciseHistory(state, id) }))
    .filter((l) => l.h.length >= 2)
    .sort((a, b) => b.h.length - a.h.length)
    .slice(0, 4)
  const first = state.weights[0]?.kg
  const now = state.profile.weightKg

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {([['Workouts', workoutsThisWeek(state), 'this week'], ['Sessions', workoutDates(state).length, 'all time'], ['Sets', state.sets.length, 'logged']] as const).map(([l, v, sub]) => (
          <Card key={l} tight style={{ flex: 1 }}><Text style={[T.title1, T.num]}>{v}</Text><Text style={T.headline}>{l}</Text><Text style={T.caption}>{sub}</Text></Card>
        ))}
      </View>

      <SectionHeader title="Volume · last 7 days" />
      <Card><Bars data={volume} /><Text style={[T.caption, { marginTop: 8 }]}>Total weight × reps per day (kg)</Text></Card>

      <SectionHeader title="Strength trends" />
      <View style={{ gap: 12 }}>
        {lifts.map((l) => {
          const gain = round(l.h[l.h.length - 1].value - l.h[0].value, 1)
          return (
            <Card key={l.id} onPress={() => router.push(`/exercise/${l.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View><Text style={T.headline}>{l.name}</Text><Text style={T.caption}>Estimated 1-rep max</Text></View>
                <Pill color={gain >= 0 ? C.green : C.red} bg={gain >= 0 ? '#E9F0E6' : '#FCE4DE'}>{`${gain >= 0 ? '+' : ''}${gain} kg`}</Pill>
              </View>
              <LineChart data={l.h} unit=" kg" height={110} />
            </Card>
          )
        })}
        {!lifts.length && <Card><Text style={T.sub}>Log a lift twice to see its trend.</Text></Card>}
      </View>

      <SectionHeader title="Body weight" action="Log" onAction={() => router.push('/weight')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[T.title1, T.num]}>{now} kg</Text>
          {first ? <Text style={[T.sub, { color: now <= first ? C.green : C.orange, fontWeight: '700' }]}>{now <= first ? '▼' : '▲'} {Math.abs(round(now - first, 1))} kg</Text> : null}
        </View>
        <Text style={T.caption}>Target {state.profile.targetWeightKg} kg</Text>
        <View style={{ marginTop: 10 }}><LineChart data={state.weights.map((w) => ({ value: w.kg }))} unit=" kg" color={C.fat} height={110} /></View>
        <Button title="Log weight" variant="tinted" icon="scale-outline" onPress={() => router.push('/weight')} style={{ marginTop: 10 }} />
      </Card>
    </View>
  )
}
