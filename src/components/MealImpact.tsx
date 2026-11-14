import { Text, View } from 'react-native'
import { claimsFor, shareOfDay, trafficLights, type Composition } from '../lib/impact'
import { fmt } from '../lib/nutrition'
import type { Targets } from '../lib/types'
import { C, T } from '../theme'
import { Bar, Card, Icon } from './ui'

const LIGHT = { low: C.green, medium: C.orange, high: C.red }
const LIGHT_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }

/** "What this meal gives you": share of your day, FSA traffic lights, and UK-authorised claims only. */
export function MealImpact({ c, targets, servings = 1 }: { c: Composition; targets: Targets; servings?: number }) {
  const portion: Composition = { ...c, kcal: c.kcal * servings, protein: c.protein * servings, carbs: c.carbs * servings, fat: c.fat * servings, fiber: c.fiber * servings, sugar: c.sugar * servings, satFat: c.satFat * servings, salt: c.salt * servings, grams: c.grams * servings }
  const share = shareOfDay(portion, targets)
  const lights = trafficLights(portion)
  const claims = claimsFor(c)
  const rows = [['Calories', share.kcal, `${fmt.kcal(portion.kcal)} kcal`, C.sky], ['Protein', share.protein, `${fmt.g(portion.protein)} g`, C.protein], ['Carbs', share.carbs, `${fmt.g(portion.carbs)} g`, C.carbs], ['Fat', share.fat, `${fmt.g(portion.fat)} g`, C.fat]] as const
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="target" size={20} color={C.accent} /><Text style={T.title3}>What this meal gives you</Text></View>

      <View style={{ gap: 10 }}>
        <Text style={T.eyebrow}>Of your daily targets</Text>
        {rows.map(([label, pct, value, color]) => (
          <View key={label} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={T.headline}>{label}</Text>
              <Text style={[T.sub, T.num]}><Text style={{ color: C.text, fontWeight: '700' }}>{Math.round(pct * 100)}%</Text> · {value}</Text>
            </View>
            <Bar pct={pct} color={color} height={6} />
          </View>
        ))}
        <Text style={[T.sub, T.num]}>Fibre: <Text style={{ color: C.text, fontWeight: '700' }}>{c.unknown.includes('fiber') ? 'at least ' : ''}{fmt.g(portion.fiber)} g</Text> (adults need about 30 g a day)</Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={T.eyebrow}>Traffic lights</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {lights.map((l) => (
            <View key={l.key} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: LIGHT[l.level] + '22', borderWidth: 1.5, borderColor: LIGHT[l.level] }}>
              <Text style={[T.caption, { color: C.text, fontWeight: '700' }]}>{l.label}</Text>
              <Text style={[T.headline, T.num]}>{l.atLeast ? '≥' : ''}{fmt.g(l.grams)}g</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: LIGHT[l.level] }}>{LIGHT_LABEL[l.level]}</Text>
            </View>
          ))}
        </View>
        <Text style={[T.caption, { lineHeight: 16 }]}>UK Food Standards Agency colour coding (per 100 g, and per portion for large portions). Excludes salt added to taste.</Text>
      </View>

      {claims.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={T.eyebrow}>What it does</Text>
          {claims.map((cl) => (
            <View key={cl.text} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={cl.icon} size={17} color={C.accent} /></View>
              <Text style={[T.body, { flex: 1, lineHeight: 20 }, cl.kind === 'health' && { fontWeight: '600' }]}>{cl.text}</Text>
            </View>
          ))}
          <Text style={[T.caption, { lineHeight: 16 }]}>Shown only when the meal meets the conditions of the GB Nutrition and Health Claims rules. Part of a varied, balanced diet and a healthy lifestyle.</Text>
        </View>
      )}
    </Card>
  )
}
