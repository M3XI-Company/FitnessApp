import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { exerciseById } from '../../data/exercises'
import { prettyDate, todayKey } from '../../lib/date'
import { nextTarget } from '../../lib/progress'
import { WEEKDAY_LABEL, dayProgress, routineFor, routineStreak, weekProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, G, T } from '../../theme'
import { Bar, Button, Card, Icon, List, Row } from '../ui'

/**
 * Today: the day's part of the weekly routine as a checklist. An exercise is
 * ticked once its sets are ticked off on its own screen; when every exercise
 * is ticked the day is complete. Days are saved as they happen, so the week
 * strip and the streak always reflect what was actually done.
 */
export function Today({ onAskCoach }: { onAskCoach: (question: string) => void }) {
  const { state } = useStore()
  const today = dayProgress(state)
  const week = weekProgress(state)
  const streak = routineStreak(state)
  const routine = routineFor(state)
  // advice is based on earlier sessions, so it does not move while today's sets are ticked off
  const before = { ...state, sets: state.sets.filter((x) => x.date !== todayKey()) }
  const next = today.items.find((i) => !i.complete)

  return (
    <View style={{ gap: 12 }}>
      <LinearGradient colors={G.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.skyLight, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }}>{prettyDate(today.date).toUpperCase()}</Text>
            <Text style={{ color: C.cloud, fontSize: 24, fontWeight: '800', lineHeight: 30, marginTop: 2 }}>{today.day.title}</Text>
            {!!today.day.focus && <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 14 }}>{today.day.focus}</Text>}
          </View>
          <View accessibilityLabel={`Streak: ${streak} day${streak === 1 ? '' : 's'}`} style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.12)' }}>
            <Icon name="flame" size={24} color={streak ? '#FF8A3D' : 'rgba(255,255,255,.5)'} />
            <Text style={[T.num, { color: C.cloud, fontSize: 20, fontWeight: '800' }]}>{streak}</Text>
            <Text style={{ color: 'rgba(255,255,255,.75)', fontSize: 10, fontWeight: '600' }}>day streak</Text>
          </View>
        </View>
        {today.status !== 'rest' && (
          <View style={{ gap: 6 }}>
            <Bar pct={today.items.length ? today.doneItems / today.items.length : 0} color={C.skyLight} track="rgba(255,255,255,.18)" />
            <Text style={{ color: 'rgba(255,255,255,.9)', fontSize: 13 }}>
              {today.status === 'done' ? 'Day complete and saved. See you tomorrow.' : `${today.doneItems} of ${today.items.length} exercises done`}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* the week at a glance */}
      <Card tight style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {week.map((d) => {
          const isToday = d.date === today.date
          const future = d.date > today.date
          const bg = d.status === 'done' ? C.accent : d.status === 'rest' ? 'transparent' : d.status === 'started' ? C.accentSoft : C.fill
          return (
            <View key={d.date} accessibilityLabel={`${WEEKDAY_LABEL[d.weekday]}: ${d.status === 'rest' ? 'rest day' : d.status === 'done' ? 'done' : future ? 'planned' : isToday ? 'today' : 'missed'}`} style={{ alignItems: 'center', gap: 6 }}>
              <Text style={[T.caption, { fontWeight: isToday ? '800' : '600', color: isToday ? C.text : C.text3 }]}>{WEEKDAY_LABEL[d.weekday]}</Text>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: isToday ? 2 : 0, borderColor: C.accent }}>
                {d.status === 'done' ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : d.status === 'rest' ? <Icon name="moon" size={15} color={C.text3} /> : null}
              </View>
            </View>
          )
        })}
      </Card>

      {today.status === 'rest' ? (
        <Card style={{ gap: 6 }}>
          <Text style={T.title3}>Rest is part of the plan</Text>
          <Text style={T.sub}>No training today. A walk, some stretching and a good night&apos;s sleep are what make the next session count.</Text>
        </Card>
      ) : (
        <>
          <List>
            {today.items.map((it, i) => {
              const ex = exerciseById(it.exerciseId)
              const target = nextTarget(before, it.exerciseId)
              const load = target?.weight ? ` · ${target.weight} kg` : ''
              return (
                <Row key={it.exerciseId} first={i === 0} onPress={() => router.push(`/exercise/${it.exerciseId}`)}
                  left={<Icon name={it.complete ? 'checkbox' : 'square-outline'} size={26} color={it.complete ? C.accent : it === next ? C.text2 : C.text3} />}
                  title={<Text style={[T.headline, it.complete && { color: C.text3, textDecorationLine: 'line-through' }]}>{ex?.name ?? it.exerciseId}</Text>}
                  subtitle={`${it.sets} sets × ${it.reps}${load}${it.done && !it.complete ? ` · ${it.done} of ${it.sets} done` : ''}`}
                  right={<Icon name="chevron-forward" size={16} color={C.text3} />} />
              )
            })}
          </List>
          {next && <Button title={today.status === 'todo' ? `Start: ${exerciseById(next.exerciseId)?.name}` : `Next: ${exerciseById(next.exerciseId)?.name}`} icon="play" onPress={() => router.push(`/exercise/${next.exerciseId}`)} />}
        </>
      )}

      <Card tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="sparkles" size={22} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={T.headline}>{routine.source === 'coach' ? 'Routine from your AI coach' : 'Routine built from your profile'}</Text>
          <Text style={T.caption}>Want different days, exercises or equipment? Talk it through with the coach.</Text>
        </View>
        <Button title="Change" variant="tinted" small onPress={() => onAskCoach('I want to change my weekly routine')} />
      </Card>
    </View>
  )
}
