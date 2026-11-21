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
import { Bar, Card, Icon, success, tap } from '../ui'

// the colours of the session in progress: near-black, a warm gold for what is live, pale sky for the rest
const INK = '#0B1422'
const GOLD = '#F2D27A'
const PALE = 'rgba(255,255,255,0.72)'

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

  const upNext = left.find((i) => i.exerciseId !== current.exerciseId)
  const nextName = upNext ? exerciseById(upNext.exerciseId)?.name : undefined

  // the session in progress is the one dark thing in the chat: it reads as a different place, the gym floor
  return (
    <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: INK }}>
      <ExerciseFigure key={ex.id} exerciseId={ex.id} sex={state.profile.sex} height={250} />
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[T.num, { color: GOLD, fontWeight: '800', fontSize: 12, letterSpacing: 1 }]}>SET {current.done + 1} / {current.sets}{style ? ` · ${STYLE_LABEL[style].toUpperCase()}` : ''}</Text>
            <Text style={[T.num, { color: PALE, fontWeight: '600', fontSize: 12 }]}>{index + 1} of {day.items.length} · about {remaining} min left</Text>
          </View>
          <Bar pct={day.doneItems / day.items.length} height={4} color={GOLD} track="rgba(255,255,255,0.12)" />
        </View>
        <Text style={[T.title2, { color: '#fff' }]}>{ex.name}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel={`${weight ? `${weight} kilograms, ` : ''}${reps} ${timed ? 'seconds' : 'reps'}`}>
          <View>
            <Text style={[T.bigNum, T.num, { color: '#fff' }]}>{reps}</Text>
            <Text style={{ color: PALE, fontSize: 13, fontWeight: '600' }}>{timed ? 'Seconds' : 'Reps'}</Text>
          </View>
          {weight > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[T.bigNum, T.num, { color: '#fff' }]}>{weight}</Text>
              <Text style={{ color: PALE, fontSize: 13, fontWeight: '600' }}>Kg</Text>
            </View>
          )}
        </View>
        <Text style={{ color: PALE, fontSize: 14, lineHeight: 20 }}>
          {works.length ? `Works your ${list(works)}. ` : ''}{ex.cues[0]}{/[.!?]$/.test(ex.cues[0] ?? '') ? '' : '.'}
          {current.done > 0 ? ` Rest about ${rest >= 120 ? `${Math.round(rest / 60)} minutes` : `${rest} seconds`} between sets.` : ''}
        </Text>
        {!!why && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12.5, lineHeight: 17 }}>{why}</Text>}
        {tips.length > 0 && (
          <View style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' }}>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.9, color: GOLD }}>FOR YOUR BUILD</Text>
            {tips.map((t) => <Text key={t} style={{ color: '#fff', fontSize: 13.5, lineHeight: 19 }}>{t}</Text>)}
          </View>
        )}
        <Pressable onPress={setDone} accessibilityRole="button" accessibilityLabel={lastSet ? 'Set done, next exercise' : 'Set done'}
          style={({ pressed }) => [{ height: 54, borderRadius: 27, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && { opacity: 0.8 }]}>
          <Icon name="checkmark" size={20} color={INK} />
          <Text style={{ color: INK, fontWeight: '800', fontSize: 16 }}>{lastSet ? 'Set done · next exercise' : 'Set done'}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {supportsForm(ex.id) && <Link icon="videocam-outline" label="Check my form" onPress={() => router.push(`/form-check/${ex.id}`)} />}
          <Link icon="information-circle" label="More detail" onPress={() => router.push(`/exercise/${ex.id}`)} />
          {left.length > 1 && <Link icon="arrow-forward" label="Do this later" onPress={() => setSkipped(skipped.includes(ex.id) ? [] : [...skipped, ex.id])} />}
          {day.doneItems + current.done > 0 && <Link icon="flag-outline" label="End session" onPress={endSession} />}
        </View>
      </View>
      {!!nextName && (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
          <Text style={{ color: GOLD, fontWeight: '700', fontSize: 13 }}>Next</Text>
          <Text style={{ color: PALE, fontSize: 13, flex: 1 }} numberOfLines={1}>{nextName}</Text>
        </View>
      )}
    </View>
  )
}

function Link({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress() }} hitSlop={8} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={15} color={C.skyLight} />
      <Text style={{ color: C.skyLight, fontWeight: '600', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  )
}
