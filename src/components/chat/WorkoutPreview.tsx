import { Image, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { sessionMinutes } from '../../lib/chat'
import { prettyDate, todayKey } from '../../lib/date'
import { exerciseById } from '../../data/exercises'
import { nextTarget } from '../../lib/progress'
import { dayProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, T, shadow } from '../../theme'
import { exerciseArt } from '../trainer/ExerciseFigure'
import { Button, Icon, tap } from '../ui'

/** What happens once the last set is ticked off, so nobody wonders where their work goes. */
const AFTER = ['Every set you tick is saved.', 'I ask how it felt and where you felt it.', 'Your next weights are set from that.']

/**
 * A workout laid out before it is done: each exercise with its picture, sets
 * and reps, and what happens when it is finished. Tapping an exercise opens
 * its page, where the picture moves through the rep.
 */
export function WorkoutPreview({ date, onStart }: { date: string; onStart: () => void }) {
  const { state } = useStore()
  const p = dayProgress(state, date)
  const isToday = date === todayKey()
  if (p.status === 'rest') {
    return (
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 15, ...shadow }}>
        <Text style={T.headline}>{isToday ? 'Today' : prettyDate(date)} is a rest day</Text>
        <Text style={[T.caption, { marginTop: 4 }]}>A walk or some stretching is plenty.</Text>
      </View>
    )
  }
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', ...shadow }}>
      <View style={{ paddingHorizontal: 15, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={[T.caption, { letterSpacing: 0.6, fontWeight: '700', color: C.accent }]}>{(isToday ? 'Today' : prettyDate(date)).toUpperCase()}</Text>
        <Text style={T.headline}>{p.day.title}</Text>
        <Text style={[T.caption, T.num]}>{p.items.length} exercises · about {sessionMinutes(p.items)} minutes</Text>
      </View>
      {p.items.map((it, n) => {
        const art = exerciseArt(it.exerciseId, state.profile.sex)
        const ex = exerciseById(it.exerciseId)
        const name = ex?.name ?? it.exerciseId
        // the weight to use is worked out from the user's own sessions, so there is nothing for them to set
        const kg = nextTarget(state, it.exerciseId, { reps: it.reps, style: p.day.style })?.weight
        return (
          <Pressable key={it.exerciseId} onPress={() => { tap(); router.push(`/exercise/${it.exerciseId}`) }} accessibilityRole="button" accessibilityLabel={`${name}, ${it.sets} sets of ${it.reps}. Opens how to do it.`}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
            <View style={{ width: 64, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              {art ? <Image source={art} resizeMode="cover" style={{ width: 64, height: 44 }} /> : <Icon name="barbell" size={20} color={C.accent} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{n + 1}. {name}</Text>
              <Text style={[T.caption, T.num]}>{it.sets} sets × {it.reps}{kg ? ` · ${kg} kg` : ''}{it.complete ? ' · done' : ''}</Text>
              {!!ex && <Text style={T.caption}>{ex.equipment} · {ex.muscle}</Text>}
            </View>
            <Icon name="chevron-forward" size={16} color={C.text3} />
          </Pressable>
        )
      })}
      <View style={{ paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.sep, gap: 3 }}>
        <Text style={[T.caption, { fontWeight: '700', color: C.text }]}>When you finish</Text>
        {AFTER.map((line, i) => <Text key={line} style={T.caption}>{i + 1}. {line}</Text>)}
        {isToday && p.status !== 'done' && <Button small icon="play" title={p.status === 'started' ? 'Continue workout' : 'Start workout'} style={{ marginTop: 8 }} onPress={onStart} />}
      </View>
    </View>
  )
}
