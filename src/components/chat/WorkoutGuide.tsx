import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { MUSCLE_NAME, exerciseById, worksFor } from '../../data/exercises'
import { checkinMessage, restSeconds, sessionMinutes } from '../../lib/chat'
import { todayKey, uid } from '../../lib/date'
import { supportsForm } from '../../lib/form/engine'
import { formTips } from '../../lib/fit'
import { easingIn, nextTarget } from '../../lib/progress'
import { STYLE_LABEL, STYLE_MEANING, dayProgress, routineStreak } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, T } from '../../theme'
import { ExerciseFigure } from '../trainer/ExerciseFigure'
import { Bar, Button, Card, Icon, success, tap } from '../ui'

const plain = (name: string) => name.replace(/\s*\(.*\)/, '').toLowerCase()
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')

/**
 * The coach walking the user through today's workout, one exercise at a time:
 * what to do, how many, roughly how long, one form cue, and a figure
 * showing the position and the muscles it works, with form tips that fit
 * the user's own build. There is no clock; a set is ticked off when the user
 * says it is done, and the session can be ended at any point, which leads to
 * the spoken debrief. Only the latest guide in the chat
 * is live (`active`), so one 3D figure is drawn at a time.
 */
export function WorkoutGuide({ date, active }: { date: string; active: boolean }) {
  const { state, dispatch } = useStore()
  const [skipped, setSkipped] = useState<string[]>([])
  const day = dayProgress(state, date)
  const isToday = date === todayKey()
  // advice comes from earlier sessions, so it does not move while today's sets are ticked off
  const before = useMemo(() => ({ ...state, sets: state.sets.filter((x) => x.date !== date) }), [state, date])
  const left = day.items.filter((i) => !i.complete)
  const current = left.find((i) => !skipped.includes(i.exerciseId)) ?? left[0]
  // the user ended the session before the last exercise
  const ended = state.chat.some((m) => m.checkin === date)

  if (day.status === 'rest') return null
  if (day.status === 'done') {
    const streak = routineStreak(state)
    return (
      <Card tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="checkmark-circle" size={28} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>{day.day.title} complete</Text>
          <Text style={T.caption}>{isToday && streak > 0 ? `Saved. ${streak} day${streak === 1 ? '' : 's'} in a row.` : 'Saved.'}</Text>
        </View>
      </Card>
    )
  }
  if (!active || !isToday || !current || ended) {
    return (
      <Card tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="barbell-outline" size={22} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>{day.day.title}</Text>
          <Text style={T.caption}>{ended ? 'Session ended. ' : ''}{day.doneItems} of {day.items.length} exercises done</Text>
        </View>
      </Card>
    )
  }

  const ex = exerciseById(current.exerciseId)
  if (!ex) return null
  const style = day.day.style
  const target = nextTarget(before, ex.id, { reps: current.reps, style })
  const tips = formTips(ex.id, state.profile, state.bodyScan)
  // why this weight on the first set, then what this kind of day asks for
  const why = current.done === 0 && target?.note ? target.note : style ? STYLE_MEANING[style] : ''
  const weight = target?.weight ?? 0
  const reps = target?.reps ?? ex.reps[0]
  const timed = ex.id === 'plank'
  const index = day.items.findIndex((i) => i.exerciseId === current.exerciseId)
  const remaining = sessionMinutes(left.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets - i.done })), false)
  const works = worksFor(ex.id).primary.map((m) => plain(MUSCLE_NAME[m]))
  const rest = restSeconds(ex.id)
  const lastSet = current.done + 1 >= current.sets

  const setDone = () => {
    dispatch({ type: 'addSet', set: { id: uid(), date, exerciseId: ex.id, weight, reps } })
    success()
  }
  // stop here: what is done is kept, and Breeze asks out loud how it went
  const endSession = () => dispatch({ type: 'chat', messages: [checkinMessage(date, { early: true, easing: easingIn(before) })] })

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <ExerciseFigure key={ex.id} exerciseId={ex.id} sex={state.profile.sex} height={250} />
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ gap: 6 }}>
          <Text style={[T.caption, { fontWeight: '700', letterSpacing: 1, color: C.text3 }]}>{style ? `${STYLE_LABEL[style].toUpperCase()} · ` : ''}EXERCISE {index + 1} OF {day.items.length} · ABOUT {remaining} MIN LEFT</Text>
          <Bar pct={day.doneItems / day.items.length} height={5} />
        </View>
        <View>
          <Text style={T.title3}>{ex.name}</Text>
          <Text style={[T.headline, T.num, { color: C.accent, marginTop: 2 }]}>
            Set {current.done + 1} of {current.sets} · {weight ? `${weight} kg × ` : ''}{reps}{timed ? ' seconds' : ' reps'}
          </Text>
        </View>
        <Text style={[T.sub, { lineHeight: 19 }]}>
          {works.length ? `Works your ${list(works)}. ` : ''}{ex.cues[0]}{/[.!?]$/.test(ex.cues[0] ?? '') ? '' : '.'}
          {current.done > 0 ? ` Rest about ${rest >= 120 ? `${Math.round(rest / 60)} minutes` : `${rest} seconds`} between sets.` : ''}
        </Text>
        {!!why && <Text style={[T.caption, { lineHeight: 17 }]}>{why}</Text>}
        {tips.length > 0 && (
          <View style={{ gap: 4, padding: 10, borderRadius: 12, backgroundColor: C.accentSoft }}>
            <Text style={[T.caption, { fontWeight: '700', letterSpacing: 0.8, color: C.accent }]}>FOR YOUR BUILD</Text>
            {tips.map((t) => <Text key={t} style={[T.sub, { color: C.text, lineHeight: 19 }]}>{t}</Text>)}
          </View>
        )}
        <Button title={lastSet ? 'Set done · next exercise' : 'Set done'} icon="checkmark" onPress={setDone} />
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {supportsForm(ex.id) && <Link icon="videocam-outline" label="Check my form" onPress={() => router.push(`/form-check/${ex.id}`)} />}
          <Link icon="information-circle" label="More detail" onPress={() => router.push(`/exercise/${ex.id}`)} />
          {left.length > 1 && <Link icon="arrow-forward" label="Do this later" onPress={() => setSkipped(skipped.includes(ex.id) ? [] : [...skipped, ex.id])} />}
          {day.doneItems + current.done > 0 && <Link icon="flag-outline" label="End session" onPress={endSession} />}
        </View>
      </View>
    </Card>
  )
}

function Link({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress() }} hitSlop={8} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={15} color={C.accent} />
      <Text style={{ color: C.accent, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  )
}
