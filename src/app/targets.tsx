import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../lib/store'
import { computeTargets, targetAssumptions } from '../lib/nutrition'
import type { Targets } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, SheetHeader, Stepper, success } from '../components/ui'

const ROWS: [keyof Targets, string, number, string][] = [
  ['kcal', 'Calories', 50, 'kcal'], ['protein', 'Protein', 5, 'g'], ['carbs', 'Carbohydrates', 5, 'g'], ['fat', 'Fat', 5, 'g'], ['waterMl', 'Water', 250, 'ml'],
]

/** View and adjust daily targets, with the assumptions behind the calculated ones. */
export default function TargetsScreen() {
  const { state, dispatch } = useStore()
  const calc = computeTargets(state.profile)
  const [t, setT] = useState<Targets>(state.targets)
  const macroKcal = t.protein * 4 + t.carbs * 4 + t.fat * 9
  const custom = (Object.keys(calc) as (keyof Targets)[]).filter((k) => t[k] !== calc[k])

  const save = () => {
    const over: Partial<Targets> = {}
    for (const k of custom) over[k] = t[k]
    dispatch({ type: 'setTargets', custom: custom.length ? over : undefined })
    success(); router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Daily targets" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Card style={{ gap: 14 }}>
          {ROWS.map(([k, label, step, unit]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={T.headline}>{label}</Text>
                <Text style={T.caption}>{t[k] === calc[k] ? 'Calculated' : `Your setting · calculated ${calc[k]} ${unit}`}</Text>
              </View>
              <Stepper value={t[k]} step={step} min={k === 'kcal' ? 1000 : 0} suffix={unit} onChange={(v) => setT({ ...t, [k]: Math.round(v) })} />
            </View>
          ))}
        </Card>
        {Math.abs(macroKcal - t.kcal) > t.kcal * 0.05 && (
          <Card tight style={{ backgroundColor: '#FFEBDD' }}>
            <Text style={[T.sub, { color: C.text, lineHeight: 19 }]}>Your macros add up to {Math.round(macroKcal)} kcal (protein and carbs 4 kcal/g, fat 9 kcal/g), which differs from your {t.kcal} kcal target. That’s allowed, but the rings may not finish together.</Text>
          </Card>
        )}
        <Button title="Save targets" onPress={save} />
        {state.customTargets && <Button title="Reset to calculated" variant="ghost" icon="refresh" onPress={() => setT(calc)} />}
        <Card style={{ gap: 8 }}>
          <Text style={T.title3}>How we calculate these</Text>
          {targetAssumptions(state.profile).map((line) => <Text key={line} style={[T.body, { lineHeight: 21 }]}>• {line}</Text>)}
          <Button small variant="tinted" title="Update my details" onPress={() => router.push('/onboarding')} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
        </Card>
      </ScrollView>
    </View>
  )
}
