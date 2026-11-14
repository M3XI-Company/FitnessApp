import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../../lib/store'
import { MUSCLE_COLOR, exerciseById, worksFor } from '../../data/exercises'
import { MuscleMap } from '../../components/MuscleMap'
import { exerciseHistory, nextTarget } from '../../lib/progress'
import { prettyDate, todayKey, uid } from '../../lib/date'
import { e1rm, round } from '../../lib/nutrition'
import { C, T, G, F } from '../../theme'
import { Button, Card, Icon, LineChart, Pill, SectionHeader, SheetHeader, success, tap } from '../../components/ui'
import { Trainer3D } from '../../components/trainer/Trainer3D'
import { FormSteps } from '../../components/trainer/FormSteps'
import { RestTimer } from '../../components/RestTimer'
import { supportsForm } from '../../lib/form/engine'

/** sets advised per exercise per session */
const ADVISED_SETS = 3

export default function ExerciseDetail() {
  const { id, pr: prFlag } = useLocalSearchParams<{ id: string; pr?: string }>()
  const { state, dispatch } = useStore()
  const ex = exerciseById(id)
  // today's advice comes from earlier sessions only, so it stays the same while today's sets are ticked off
  const before = useMemo(() => ({ ...state, sets: state.sets.filter((x) => x.date !== todayKey()) }), [state])
  const target = ex ? nextTarget(before, ex.id) : null
  // weight and reps are advised, never typed in: see nextTarget (lib/progress)
  const weight = target?.weight ?? 0
  const reps = target?.reps ?? 8
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [extra, setExtra] = useState(0)
  if (!ex) return <View style={{ flex: 1, backgroundColor: C.bg }}><SheetHeader title="Not found" onClose={() => router.back()} /></View>

  const all = state.sets.filter((s) => s.exerciseId === ex.id)
  const today = all.filter((s) => s.date === todayKey())
  const hist = exerciseHistory(state, ex.id)
  const pr = all.length ? all.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b)) : null
  const sessions = [...new Set(all.map((s) => s.date))].sort().reverse().slice(0, 6)
  const isTimed = ex.id === 'plank'
  // advised sets, plus any the user added or already logged beyond them
  const rows = Math.max(ADVISED_SETS + extra, today.length)

  const logSet = () => {
    const isPR = !pr || e1rm(weight, reps) > e1rm(pr.weight, pr.reps)
    dispatch({ type: 'addSet', set: { id: uid(), date: todayKey(), exerciseId: ex.id, weight, reps } })
    success()
    const secs = ex.equipment === 'Barbell' || ex.level === 'Advanced' ? 150 : ex.muscle === 'Core' || ex.muscle === 'Cardio' ? 45 : 90
    // runs in the Log set press handler, not during render
    setRest({ endsAt: Date.now() + secs * 1000, total: secs }) // eslint-disable-line react-hooks/purity
    if (isPR && all.length) router.setParams({ pr: '1' })
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title={ex.name} onClose={() => router.back()} fallback="/fitness" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          <Pill color={MUSCLE_COLOR[ex.muscle]} bg={MUSCLE_COLOR[ex.muscle] + '1A'}>{ex.muscle}</Pill>
          <Pill color={C.text2} bg={C.fill}>{ex.equipment}</Pill>
          <Pill color={C.text2} bg={C.fill}>{ex.level}</Pill>
        </View>

        <Trainer3D exerciseId={ex.id} />
        <Text style={[T.caption, { marginTop: 8, marginBottom: 14, lineHeight: 16 }]}>Demonstration only — move within a comfortable range and stop if you feel pain.</Text>
        <Card style={{ marginBottom: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="muscle" size={20} color={C.accent} /><Text style={T.title3}>Muscles worked</Text></View>
          <MuscleMap primary={worksFor(ex.id).primary} secondary={worksFor(ex.id).secondary} gender={state.profile.sex} />
        </Card>
        {/* Form: pictures of each key position, then the cues */}
        <SectionHeader title="Form" />
        <FormSteps exerciseId={ex.id} />
        <Card style={{ gap: 10, marginTop: 10, marginBottom: 14 }}>
          {ex.cues.map((c, i) => (
            <View key={c} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.skyLight, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
              <Text style={[T.body, { flex: 1 }]}>{c}</Text>
            </View>
          ))}
        </Card>
        {supportsForm(ex.id) && (
          <Button title="Check my form with the camera" icon="videocam-outline" variant="tinted" onPress={() => router.push(`/form-check/${ex.id}`)} style={{ marginBottom: 14 }} />
        )}

        {/* Progression target */}
        {target && (
          <LinearGradient colors={G.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18 }}>
            <Text style={{ color: C.skyLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>TODAY&apos;S TARGET</Text>
            <Text style={{ color: C.cloud, fontSize: 40, fontFamily: F.hand, lineHeight: 44, marginTop: 2 }}>
              {target.weight ? `${target.weight} kg × ` : ''}{target.reps}{isTimed ? ' s' : ' reps'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,.9)', fontSize: 14, marginTop: 4 }}>{target.note}</Text>
          </LinearGradient>
        )}

        {prFlag === '1' && (
          <Card tight style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.accentSoft }}>
            <Icon name="trophy" size={24} color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>New personal record!</Text>
          </Card>
        )}

        {/* Logger */}
        {/* Logger: a checklist of the advised sets. Ticking a set logs it at the advised weight and reps. */}
        <SectionHeader title="Today's sets" />
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {Array.from({ length: rows }, (_, i) => {
            const done = today[i]
            const label = done
              ? `${done.weight ? `${done.weight} kg × ` : ''}${done.reps}${isTimed ? ' s' : ' reps'}`
              : `${ex.step > 0 ? `${weight} kg × ` : ''}${reps}${isTimed ? ' s' : ' reps'}`
            return (
              <Pressable key={done?.id ?? `todo${i}`} accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} accessibilityLabel={`Set ${i + 1}, ${label}`}
                onPress={() => { if (done) { tap(); dispatch({ type: 'removeSet', id: done.id }) } else logSet() }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }, pressed && { opacity: 0.6 }]}>
                <Icon name={done ? 'checkbox' : 'square-outline'} size={26} color={done ? C.accent : C.text2} />
                <Text style={[T.headline, { width: 52, color: done ? C.text3 : C.text }]}>Set {i + 1}</Text>
                <Text style={[T.headline, T.num, { flex: 1, color: done ? C.text3 : C.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{label}</Text>
                {done && <Text style={[T.caption, T.num]}>e1RM {round(e1rm(done.weight, done.reps), 1)}</Text>}
              </Pressable>
            )
          })}
          {today.length >= rows && <Button title="Add another set" icon="add" variant="ghost" small onPress={() => setExtra(extra + 1)} style={{ marginVertical: 8 }} />}
          {rest && <View style={{ paddingBottom: 8 }}><RestTimer endsAt={rest.endsAt} total={rest.total} onChange={(endsAt, total) => setRest({ endsAt, total })} onDone={() => setRest(null)} /></View>}
        </Card>
        <Text style={[T.caption, { marginTop: 6, marginLeft: 4 }]}>{today.length >= ADVISED_SETS ? 'All advised sets done. Nice work.' : `Tick each set as you finish it. ${today.length} of ${ADVISED_SETS} done.`}</Text>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Personal best</Text><Text style={[T.title3, T.num]}>{pr ? `${pr.weight}×${pr.reps}` : '—'}</Text></Card>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Best e1RM</Text><Text style={[T.title3, T.num]}>{pr ? `${round(e1rm(pr.weight, pr.reps), 1)} kg` : '—'}</Text></Card>
          <Card tight style={{ flex: 1 }}><Text style={T.caption}>Sessions</Text><Text style={[T.title3, T.num]}>{hist.length}</Text></Card>
        </View>

        <SectionHeader title="Progression" />
        <Card><LineChart data={hist} unit=" kg" /><Text style={[T.caption, { marginTop: 6 }]}>Best estimated 1-rep max per session (Epley)</Text></Card>

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
