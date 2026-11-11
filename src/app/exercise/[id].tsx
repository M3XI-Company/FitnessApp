import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { MUSCLE_COLOR, exerciseById } from '../../data/exercises'
import { exerciseHistory, nextTarget } from '../../lib/progress'
import { prettyDate, todayKey, uid } from '../../lib/date'
import { e1rm, round } from '../../lib/nutrition'
import { C, T } from '../../theme'
import { Button, Card, Icon, LineChart, Pill, SectionHeader, SheetHeader, Stepper, success, tap } from '../../components/ui'

export default function ExerciseDetail() {
  const { id, pr: prFlag } = useLocalSearchParams<{ id: string; pr?: string }>()
  const { state, dispatch } = useStore()
  const ex = exerciseById(id)
  const target = ex ? nextTarget(state, ex.id) : null
  const [weight, setWeight] = useState(target?.weight ?? 20)
  const [reps, setReps] = useState(target?.reps ?? 8)
  if (!ex) return <View style={{ flex: 1, backgroundColor: C.bg }}><SheetHeader title="Not found" onClose={() => router.back()} /></View>

  const all = state.sets.filter((s) => s.exerciseId === ex.id)
  const today = all.filter((s) => s.date === todayKey())
  const hist = exerciseHistory(state, ex.id)
  const pr = all.length ? all.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b)) : null
  const sessions = [...new Set(all.map((s) => s.date))].sort().reverse().slice(0, 6)
  const isTimed = ex.id === 'plank'

  const logSet = () => {
    const isPR = !pr || e1rm(weight, reps) > e1rm(pr.weight, pr.reps)
    dispatch({ type: 'addSet', set: { id: uid(), date: todayKey(), exerciseId: ex.id, weight, reps } })
    success()
    if (isPR && all.length) router.setParams({ pr: '1' })
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={ex.name} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <Pill color={MUSCLE_COLOR[ex.muscle]} bg={MUSCLE_COLOR[ex.muscle] + '1A'}>{ex.muscle}</Pill>
          <Pill color={C.text2} bg={C.fill}>{ex.equipment}</Pill>
          <Pill color={C.text2} bg={C.fill}>{ex.level}</Pill>
        </View>

        {/* Progression target */}
        {target && (
          <LinearGradient colors={['#2A86FF', '#0047CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18 }}>
            <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>NEXT TARGET</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }}>
              {target.weight ? `${target.weight} kg × ` : ''}{target.reps}{isTimed ? ' s' : ' reps'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,.9)', fontSize: 14, marginTop: 4 }}>{target.note}</Text>
          </LinearGradient>
        )}

        {prFlag === '1' && (
          <Card tight style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF8E6' }}>
            <Text style={{ fontSize: 24 }}>🏆</Text><Text style={[T.headline, { flex: 1 }]}>New personal record!</Text>
          </Card>
        )}

        {/* Logger */}
        <SectionHeader title="Log a set" />
        <Card style={{ gap: 14 }}>
          {ex.step > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={T.headline}>Weight</Text>
              <Stepper value={weight} step={ex.step} onChange={setWeight} suffix="kg" />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={T.headline}>{isTimed ? 'Seconds' : 'Reps'}</Text>
            <Stepper value={reps} step={isTimed ? 5 : 1} min={1} onChange={setReps} />
          </View>
          <Button title={`Log set ${today.length + 1}`} icon="checkmark" onPress={logSet} />
          {today.map((s, i) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue50, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.blue, fontWeight: '800' }}>{i + 1}</Text></View>
              <Text style={[T.headline, T.num, { flex: 1 }]}>{s.weight ? `${s.weight} kg × ` : ''}{s.reps}{isTimed ? ' s' : ''}</Text>
              <Text style={[T.caption, T.num]}>e1RM {round(e1rm(s.weight, s.reps), 1)}</Text>
              <Pressable onPress={() => { tap(); dispatch({ type: 'removeSet', id: s.id }) }} hitSlop={8} accessibilityLabel="Delete set"><Icon name="trash-outline" size={18} color={C.text3} /></Pressable>
            </View>
          ))}
        </Card>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Personal best</Text><Text style={[T.title3, T.num]}>{pr ? `${pr.weight}×${pr.reps}` : '—'}</Text></Card>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Best e1RM</Text><Text style={[T.title3, T.num]}>{pr ? `${round(e1rm(pr.weight, pr.reps), 1)} kg` : '—'}</Text></Card>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Sessions</Text><Text style={[T.title3, T.num]}>{hist.length}</Text></Card>
        </View>

        <SectionHeader title="Progression" />
        <Card><LineChart data={hist} unit=" kg" /><Text style={[T.caption, { marginTop: 6 }]}>Best estimated 1-rep max per session (Epley)</Text></Card>

        <SectionHeader title="Form cues" />
        <Card style={{ gap: 10 }}>
          {ex.cues.map((c, i) => (
            <View key={c} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
              <Text style={[T.body, { flex: 1 }]}>{c}</Text>
            </View>
          ))}
        </Card>

        {sessions.length > 0 && <SectionHeader title="History" />}
        <View style={{ gap: 10 }}>
          {sessions.map((d) => (
            <Card key={d} tight>
              <Text style={T.headline}>{prettyDate(d)}</Text>
              <Text style={[T.sub, T.num, { marginTop: 2 }]}>{all.filter((s) => s.date === d).map((s) => `${s.weight ? s.weight + '×' : ''}${s.reps}`).join('   ')}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
