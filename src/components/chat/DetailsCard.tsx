import { Text, View } from 'react-native'
import { todayKey } from '../../lib/date'
import { useStore } from '../../lib/store'
import type { Activity, DetailsChange, GoalType } from '../../lib/types'
import { C, T } from '../../theme'
import { Button, Card, Icon, success } from '../ui'

const GOAL: Record<GoalType, string> = { lose: 'Lose weight', maintain: 'Stay the same', gain: 'Build muscle' }
const ACTIVITY: Record<Activity, string> = { sedentary: 'Mostly sitting', light: 'Lightly active', moderate: 'Moderately active', active: 'Very active', athlete: 'Athlete' }

/**
 * A change to the user's details that came up in conversation ("I'm 80 kilos
 * now"). It shows what would change and does nothing until the user applies
 * it; the calorie and protein targets are recalculated when they do.
 */
export function DetailsCard({ change }: { change: DetailsChange }) {
  const { state, dispatch } = useStore()
  const p = state.profile
  const rows: [string, string, string][] = []
  if (change.weightKg !== undefined) rows.push(['Weight', `${p.weightKg} kg`, `${change.weightKg} kg`])
  if (change.goal !== undefined) rows.push(['Goal', GOAL[p.goal], GOAL[change.goal]])
  if (change.targetWeightKg !== undefined) rows.push(['Target weight', `${p.targetWeightKg} kg`, `${change.targetWeightKg} kg`])
  if (change.activity !== undefined) rows.push(['Your week', ACTIVITY[p.activity], ACTIVITY[change.activity]])
  const applied = rows.every(([, from, to]) => from === to)

  const apply = () => {
    const weightKg = change.weightKg ?? p.weightKg
    const goal = change.goal ?? p.goal
    // a new goal without a stated target gets a modest one that points the right way
    const targetWeightKg = change.targetWeightKg ?? (change.goal === undefined ? p.targetWeightKg : goal === 'lose' ? weightKg - 5 : goal === 'gain' ? weightKg + 4 : weightKg)
    if (change.weightKg !== undefined) dispatch({ type: 'weight', date: todayKey(), kg: weightKg })
    dispatch({ type: 'profile', profile: { ...p, weightKg, goal, targetWeightKg, activity: change.activity ?? p.activity } })
    success()
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {rows.map(([label, from, to], i) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }}>
          <Text style={[T.headline, { flex: 1 }]}>{label}</Text>
          {from !== to && <><Text style={[T.sub, T.num]}>{from}</Text><Icon name="arrow-forward" size={14} color={C.text3} /></>}
          <Text style={[T.headline, T.num, { color: C.accent }]}>{to}</Text>
        </View>
      ))}
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.sep }}>
        {applied
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 }}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={[T.headline, { color: C.green }]}>Updated</Text></View>
          : <Button title="Update my details" icon="checkmark" onPress={apply} />}
      </View>
    </Card>
  )
}
