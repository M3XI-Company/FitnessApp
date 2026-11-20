import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { computeTargets } from '../../lib/nutrition'
import { routineStreak } from '../../lib/routine'
import { foodDays, paceLine, plannedSessions, projection, weeklySessions, weightChange, weightTrend } from '../../lib/stats'
import { useStore } from '../../lib/store'
import type { Profile } from '../../lib/types'
import { C, T } from '../../theme'
import { Bars, Button, Card, LineChart } from '../ui'

/** One number with what it is, for the row of tiles at the top of a set of charts. */
export function StatTile({ big, small, color = C.text }: { big: string; small: string; color?: string }) {
  return (
    <Card tight style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
      <Text style={[T.title2, T.num, { color }]}>{big}</Text>
      <Text style={[T.caption, { textAlign: 'center' }]}>{small}</Text>
    </Card>
  )
}

/** A chart with its heading and one line saying what it shows. */
function Chart({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={T.title3}>{title}</Text>
        <Text style={[T.sub, { lineHeight: 19 }]}>{note}</Text>
      </View>
      {children}
    </Card>
  )
}

/** Where the plan takes the person's weight, week by week. Drawn from their own numbers, so it is an estimate, not a promise. */
export function ProjectionChart({ profile, kcal }: { profile: Profile; kcal?: number }) {
  const pr = projection(profile, kcal ?? computeTargets(profile).kcal)
  if (pr.weeksToTarget === null) return null
  return (
    <Chart title="Where this takes you" note={paceLine(pr, profile)}>
      <LineChart data={pr.points.map((value) => ({ value }))} unit=" kg" color={C.green} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={T.caption}>Today · {profile.weightKg} kg</Text>
        <Text style={T.caption}>Week {pr.points.length - 1}</Text>
      </View>
      <Text style={[T.caption, { lineHeight: 17 }]}>An estimate from your calories and activity. Real weight moves in steps, so judge it over weeks.</Text>
    </Chart>
  )
}

/** The weigh-ins so far. */
export function WeightChart() {
  const { state } = useStore()
  const w = weightTrend(state)
  const change = weightChange(state)
  const note = w.length < 2 ? 'Weigh in once a week and the line appears here.' : change === 0 ? 'Holding steady since you started.' : `${change < 0 ? 'Down' : 'Up'} ${Math.abs(change)} kg since your first weigh-in.`
  return (
    <Chart title="Your weight" note={note}>
      <LineChart data={w.map((x) => ({ value: x.kg }))} unit=" kg" />
    </Chart>
  )
}

/** Sessions done each week against the number the routine asks for. */
export function SessionsChart({ weeks = 8 }: { weeks?: number }) {
  const { state } = useStore()
  const data = weeklySessions(state, weeks)
  const planned = plannedSessions(state)
  const now = data[data.length - 1].value
  return (
    <Chart title="Training each week" note={`${now} of ${planned} sessions this week. The dashed line is your plan.`}>
      <Bars data={data} target={planned} color={C.accent} />
    </Chart>
  )
}

/** Calories eaten on each of the last seven days against the target. */
export function FoodChart() {
  const { state } = useStore()
  const days = foodDays(state)
  const logged = days.filter((d) => d.kcal > 0)
  const onProtein = logged.filter((d) => d.protein >= state.targets.protein * 0.9).length
  const note = logged.length ? `Protein target hit on ${onProtein} of ${logged.length} logged day${logged.length === 1 ? '' : 's'}. The dashed line is ${state.targets.kcal} kcal.` : 'Log what you eat and each day shows here against your target.'
  return (
    <Chart title="Eating this week" note={note}>
      <Bars data={days.map((d) => ({ label: d.label, value: d.kcal }))} target={state.targets.kcal} color={C.dawn} />
    </Chart>
  )
}

/** The charts as the coach shows them in the chat: the short version, with a way through to the rest. */
export function ProgressCard() {
  const { state } = useStore()
  const streak = routineStreak(state)
  const sessions = weeklySessions(state, 1)[0].value
  const change = weightChange(state)
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile big={`${sessions}/${plannedSessions(state)}`} small="sessions this week" />
        <StatTile big={`${streak}`} small={streak === 1 ? 'day in a row' : 'days in a row'} />
        <StatTile big={`${change > 0 ? '+' : ''}${change} kg`} small="since you started" color={change === 0 ? C.text : C.green} />
      </View>
      <SessionsChart weeks={6} />
      {state.weights.length >= 2 && <WeightChart />}
      <Button small variant="tinted" icon="activity" title="See all your progress" onPress={() => router.push('/stats')} />
    </View>
  )
}
