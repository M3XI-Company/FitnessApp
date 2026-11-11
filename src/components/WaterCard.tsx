import { Text, View } from 'react-native'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { Card, IconButton, success, tap } from './ui'

export function WaterCard({ date }: { date: string }) {
  const { state, dispatch } = useStore()
  const ml = state.water[date] ?? 0
  const target = state.targets.waterMl
  const glass = state.waterPlan.glassMl
  const glasses = Math.ceil(target / glass)
  const filled = Math.floor(ml / glass)
  const pct = Math.min(1, ml / target)
  return (
    <Card style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct * 100}%`, backgroundColor: 'rgba(56,189,248,0.12)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[T.title1, T.num]}>{(ml / 1000).toFixed(2)} <Text style={[T.headline, { color: C.text3 }]}>/ {(target / 1000).toFixed(1)} L</Text></Text>
          <Text style={T.sub}>{pct >= 1 ? 'Goal reached — great job 💧' : `${Math.ceil((target - ml) / glass)} glasses to go`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="remove" variant="fill" onPress={() => dispatch({ type: 'water', date, delta: -glass })} label="Remove glass" />
          <IconButton icon="add" variant="blue" onPress={() => { if (ml + glass >= target && ml < target) success(); else tap(); dispatch({ type: 'water', date, delta: glass }) }} label="Add glass" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
        {Array.from({ length: glasses }, (_, i) => (
          <View key={i} style={{ width: 28, height: 36, borderRadius: 8, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, backgroundColor: C.fill, overflow: 'hidden', justifyContent: 'flex-end' }}>
            {i < filled && <View style={{ height: '78%', backgroundColor: i === filled - 1 ? C.blue : '#4DA3FF' }} />}
          </View>
        ))}
      </View>
    </Card>
  )
}
