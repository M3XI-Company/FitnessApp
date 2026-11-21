import { Text, View } from 'react-native'
import { C, T } from '../theme'
import { Ring } from './ui'

/** A soft glass tile: white let through, a pale edge, no hard shadow. */
const glass = { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' } as const

/**
 * What a meal gives, at a glance: the calories against the day's target as a
 * ring, then protein, fat and carbohydrate each as a ring showing its share
 * of the meal's energy, with the grams underneath.
 */
export function MacroBoard({ kcal, protein, carbs, fat, dayKcal }: { kcal: number; protein: number; carbs: number; fat: number; dayKcal: number }) {
  const energy = protein * 4 + carbs * 4 + fat * 9 || 1
  const parts = [
    { name: 'Protein', grams: protein, share: (protein * 4) / energy, color: C.protein },
    { name: 'Fat', grams: fat, share: (fat * 9) / energy, color: C.orange },
    { name: 'Carbs', grams: carbs, share: (carbs * 4) / energy, color: C.green },
  ]
  const ofDay = dayKcal > 0 ? Math.round((kcal / dayKcal) * 100) : 0
  return (
    <View style={{ gap: 10 }} accessibilityLabel={`${Math.round(kcal)} calories, ${Math.round(protein)} grams protein, ${Math.round(fat)} grams fat, ${Math.round(carbs)} grams carbohydrate`}>
      <View style={[glass, { flexDirection: 'row', alignItems: 'center', padding: 18 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[T.sub, { fontSize: 14 }]}>Total calories</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={[T.bigNum, T.num, { fontSize: 42, lineHeight: 46 }]}>{Math.round(kcal)}</Text>
            <Text style={[T.sub, { fontSize: 15 }]}>kcal</Text>
          </View>
          {ofDay > 0 && <Text style={T.caption}>{ofDay}% of your day</Text>}
        </View>
        <Ring value={kcal} max={dayKcal || kcal} size={86} stroke={9} color={C.sky} track="rgba(15,36,64,0.07)">
          <Text style={[T.headline, T.num, { fontSize: 15 }]}>{ofDay}%</Text>
        </Ring>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {parts.map((p) => (
          <View key={p.name} style={[glass, { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 8 }]}>
            <Ring value={p.share} max={1} size={64} stroke={6} color={p.color} track="rgba(15,36,64,0.07)">
              <Text style={[T.num, { fontSize: 14, fontWeight: '800', color: C.text }]}>{Math.round(p.share * 100)}%</Text>
              <Text style={[T.num, { fontSize: 11, fontWeight: '600', color: p.color }]}>{Math.round(p.grams)} g</Text>
            </Ring>
            <Text style={[T.sub, { color: C.text, fontWeight: '600' }]}>{p.name}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
