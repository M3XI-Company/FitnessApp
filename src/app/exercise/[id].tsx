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
import { C, T, G, shadow } from '../../theme'
import { Button, Card, Icon, LineChart, SectionHeader, SheetHeader, success, tap } from '../../components/ui'
import { ExerciseFigure, exerciseArt } from '../../components/trainer/ExerciseFigure'
import { RestTimer } from '../../components/RestTimer'
import { supportsForm } from '../../lib/form/engine'

/** sets advised per exercise per session */
const ADVISED_SETS = 3

/** How Breeze calls a set: said differently as the sets go by, so three sets do not read as the same line three times. */
function setLine(i: number, total: number, amount: string): string {
  if (i >= ADVISED_SETS) return `One more if you have it: ${amount}.`
  if (i === 0) return `First set: ${amount}. Go when you are ready.`
  if (i === total - 1 || i === ADVISED_SETS - 1) return `Last one: ${amount}. Make it count.`
  return `Good. Same again: ${amount}.`
}

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
      <SheetHeader title={ex.name} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        {/* facts about the exercise, written as a plain line so they are not mistaken for buttons */}
        <Text style={[T.caption, { marginBottom: 14, lineHeight: 18 }]} accessibilityLabel={`Works the ${ex.muscle.toLowerCase()}. Equipment: ${ex.equipment}. Level: ${ex.level}.`}>
          Works <Text style={{ color: MUSCLE_COLOR[ex.muscle], fontWeight: '700' }}>{ex.muscle}</Text>  ·  Equipment <Text style={{ color: C.text, fontWeight: '600' }}>{ex.equipment}</Text>  ·  Level <Text style={{ color: C.text, fontWeight: '600' }}>{ex.level}</Text>
        </Text>

        {/* the picture of the exercise, where there is one; the body chart below covers the rest */}
        {!!exerciseArt(ex.id, state.profile.sex) && (
          <>
            <View style={{ borderRadius: 22, overflow: 'hidden' }}><ExerciseFigure exerciseId={ex.id} sex={state.profile.sex} /></View>
            <Text style={[T.caption, { marginTop: 8, marginBottom: 14, lineHeight: 16 }]}>Demonstration only — move within a comfortable range and stop if you feel pain.</Text>
          </>
        )}
        <Card style={{ marginBottom: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="muscle" size={20} color={C.accent} /><Text style={T.title3}>Muscles worked</Text></View>
          <MuscleMap detail primary={worksFor(ex.id).primary} secondary={worksFor(ex.id).secondary} gender={state.profile.sex} />
        </Card>
        <SectionHeader title="Form" />
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
            <Text style={{ color: C.cloud, fontSize: 29, fontWeight: '800', lineHeight: 34, marginTop: 2 }}>
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

        {/* Logger: a short back-and-forth instead of a checklist. Breeze calls each set, the user answers Done, and it is logged at the advised weight and reps. */}
        <SectionHeader title="Today's sets" />
        <View style={{ gap: 8 }}>
          {Array.from({ length: Math.min(rows, today.length + 1) }, (_, i) => {
            const done = today[i]
            const amount = done
              ? `${done.weight ? `${done.weight} kg × ` : ''}${done.reps}${isTimed ? ' s' : ' reps'}`
              : `${ex.step > 0 ? `${weight} kg × ` : ''}${reps}${isTimed ? ' s' : ' reps'}`
            return (
              <View key={done?.id ?? `todo${i}`} style={{ gap: 8 }}>
                <View style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 6, paddingVertical: 10, paddingHorizontal: 14, ...shadow }}>
                  <Text style={[T.body, T.num, { lineHeight: 21 }]}>{setLine(i, rows, amount)}</Text>
                </View>
                {done ? (
                  <Pressable onPress={() => { tap(); dispatch({ type: 'removeSet', id: done.id }) }} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} done, ${amount}. Undo.`}
                    style={({ pressed }) => [{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.night, borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 9, paddingHorizontal: 14 }, pressed && { opacity: 0.6 }]}>
                    <Icon name="checkmark" size={15} color={C.cloud} />
                    <Text style={[T.num, { color: C.cloud, fontSize: 15 }]}>Done{done.weight ? ` · e1RM ${round(e1rm(done.weight, done.reps), 1)}` : ''}</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={logSet} accessibilityRole="button" accessibilityLabel={`Set ${i + 1} done, ${amount}`}
                    style={({ pressed }) => [{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 16 }, pressed && { opacity: 0.6 }]}>
                    <Icon name="checkmark" size={15} color={C.accent} />
                    <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15 }}>Done</Text>
                  </Pressable>
                )}
              </View>
            )
          })}
          {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} onChange={(endsAt, total) => setRest({ endsAt, total })} onDone={() => setRest(null)} />}
          {today.length >= rows && (
            <>
              <View style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: '#fff', borderRadius: 20, borderBottomLeftRadius: 6, paddingVertical: 10, paddingHorizontal: 14, ...shadow }}>
                <Text style={[T.body, { lineHeight: 21 }]}>That is all {today.length}. Nice work.</Text>
              </View>
              <Pressable onPress={() => { tap(); setExtra(extra + 1) }} accessibilityRole="button"
                style={({ pressed }) => [{ alignSelf: 'flex-end', backgroundColor: C.card, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 16 }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: C.accent, fontWeight: '700', fontSize: 15 }}>One more set</Text>
              </Pressable>
            </>
          )}
        </View>

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
