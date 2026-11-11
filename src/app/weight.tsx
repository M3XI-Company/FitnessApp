import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/date'
import { round } from '../lib/nutrition'
import { C, T } from '../theme'
import { Button, SheetHeader, Stepper, success } from '../components/ui'

export default function WeightSheet() {
  const { state, dispatch } = useStore()
  const [kg, setKg] = useState(state.profile.weightKg)
  const toGo = round(kg - state.profile.targetWeightKg, 1)
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Log weight" onClose={() => router.back()} />
      <View style={{ padding: 20, gap: 18, alignItems: 'center' }}>
        <Text style={[{ fontSize: 56, fontWeight: '800', letterSpacing: -2, color: C.text }, T.num]}>{kg.toFixed(1)}<Text style={[T.title2, { color: C.text3 }]}> kg</Text></Text>
        <Stepper value={kg} step={0.1} onChange={(v) => setKg(round(v, 1))} />
        <Text style={T.sub}>{toGo === 0 ? 'You are at your target 🎉' : `${Math.abs(toGo)} kg ${toGo > 0 ? 'above' : 'below'} your target of ${state.profile.targetWeightKg} kg`}</Text>
        <Button title="Save" style={{ alignSelf: 'stretch' }} onPress={() => { dispatch({ type: 'weight', date: todayKey(), kg }); success(); router.back() }} />
        <Text style={[T.caption, { textAlign: 'center' }]}>Your calorie and macro targets update automatically.</Text>
      </View>
    </View>
  )
}
