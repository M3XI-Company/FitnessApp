import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { RichText } from '../components/chat/RichText'
import { FoodChart, ProjectionChart, SessionsChart, StatTile, WeightChart } from '../components/stats/ProgressCharts'
import { Button, Card, Icon, SheetHeader } from '../components/ui'
import { askCoach, coachConfigured } from '../lib/coachApi'
import { todayKey, uid } from '../lib/date'
import { sessionsDone } from '../lib/progress'
import { routineStreak } from '../lib/routine'
import { plannedSessions, weeklySessions, weightChange } from '../lib/stats'
import { useStore } from '../lib/store'
import { C, T } from '../theme'

/** What the coach is asked when the person wants its view of their progress. */
const ASK = 'Look at my progress so far: my training each week against my plan, my weight, and my eating. Tell me honestly how I am doing, where you think I can be in three months if I keep this up, and the one thing I should change this week. Do not show any cards.'

/**
 * Progress: where the person is, where the plan takes them, and what the
 * coach makes of it. The coach's view is asked for once a day and kept, so
 * opening this screen does not use a message each time.
 */
export default function Stats() {
  const { state, dispatch } = useStore()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const today = todayKey()
  const view = state.insight?.date === today ? state.insight.text : ''
  const streak = routineStreak(state)
  const week = weeklySessions(state, 1)[0].value
  const change = weightChange(state)

  const ask = async () => {
    setBusy(true); setFailed(false)
    const res = await askCoach(state, [{ id: uid(), role: 'user', text: ASK }])
    setBusy(false)
    if (res.ok && res.message.text) dispatch({ type: 'insight', text: res.message.text })
    else setFailed(true)
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Your progress" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile big={`${week}/${plannedSessions(state)}`} small="sessions this week" />
          <StatTile big={`${streak}`} small={streak === 1 ? 'day in a row' : 'days in a row'} />
          <StatTile big={`${sessionsDone(state)}`} small="sessions in all" />
        </View>

        <Card style={{ gap: 10, backgroundColor: C.night }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="breeze" size={20} color={C.skyLight} />
            <Text style={[T.title3, { color: C.cloud, flex: 1 }]}>What Breeze thinks</Text>
          </View>
          {view ? (
            <RichText text={view} color={C.cloud} strong="#fff" />
          ) : busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}><ActivityIndicator color={C.skyLight} /><Text style={{ color: C.skyLight, fontSize: 15 }}>Looking at your weeks…</Text></View>
          ) : (
            <>
              <Text style={{ color: C.skyLight, fontSize: 16, lineHeight: 23 }}>{failed ? 'Breeze could not be reached just now. Try again in a moment.' : 'An honest read of how you are doing, where you can be in three months, and the one thing to change this week.'}</Text>
              <Button small variant="tinted" icon="sparkles" title={failed ? 'Try again' : 'Ask Breeze'} disabled={!coachConfigured()} onPress={ask} />
            </>
          )}
        </Card>

        <ProjectionChart profile={state.profile} kcal={state.targets.kcal} />
        <SessionsChart />
        <WeightChart />
        <FoodChart />
        {change !== 0 && <Text style={[T.caption, { textAlign: 'center' }]}>{change < 0 ? 'Down' : 'Up'} {Math.abs(change)} kg since your first weigh-in.</Text>}
        <Button small variant="ghost" icon="scale-outline" title="Log today’s weight" onPress={() => router.push('/weight')} />
      </ScrollView>
    </View>
  )
}
