import { Text, View } from 'react-native'
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter'
import { MUSCLE_NAME, MUSCLE_ROLE, type MuscleSlug } from '../data/exercises'
import { HEAT } from './trainer/heat'
import { C, T } from '../theme'

const ALL_MUSCLES: MuscleSlug[] = ['abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids', 'forearm', 'gluteal', 'hamstring', 'lower-back', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back']
const OTHER_PARTS: Slug[] = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']
const FRONT: MuscleSlug[] = ['chest', 'abs', 'obliques', 'biceps', 'quadriceps', 'deltoids', 'forearm', 'adductors', 'tibialis', 'calves']
const BACK: MuscleSlug[] = ['upper-back', 'lower-back', 'trapezius', 'triceps', 'gluteal', 'hamstring', 'calves', 'deltoids']

/** Anatomical front/back muscle map (react-native-body-highlighter, MIT). Heat map: main = hot red, assisting = amber, at rest = cool blue (same scale as the 3D trainer). */
export function MuscleMap({ primary, secondary, gender = 'male', scale = 0.62, sides = 'both', legend = true, detail = false }: {
  primary: MuscleSlug[]; secondary: MuscleSlug[]; gender?: 'male' | 'female'; scale?: number; sides?: 'both' | 'auto'; legend?: boolean
  /** say what each muscle is and does, not only its name */
  detail?: boolean
}) {
  // The artwork ships with its own dark greys, so every part gets an explicit sky-palette fill
  const worked = new Set<string>([...primary, ...secondary])
  const data: ExtendedBodyPart[] = [
    ...ALL_MUSCLES.filter((m) => !worked.has(m)).map((slug) => ({ slug, styles: { fill: '#A9D2EE' } })),
    ...OTHER_PARTS.map((slug) => ({ slug, styles: { fill: slug === 'hair' ? '#8DA0B8' : '#E4EFF8' } })),
    ...secondary.filter((m) => !primary.includes(m)).map((slug) => ({ slug, intensity: 1 })),
    ...primary.map((slug) => ({ slug, intensity: 2 })),
  ]
  const showFront = sides === 'both' || primary.some((m) => FRONT.includes(m))
  const showBack = sides === 'both' || !showFront || primary.some((m) => BACK.includes(m) && !FRONT.includes(m))
  const body = (side: 'front' | 'back') => (
    <Body data={data} side={side} gender={gender} scale={scale} colors={[HEAT.assist, HEAT.main]} border="none" />
  )
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: sides === 'both' ? 4 : 0 }}>
        {showFront && <View style={{ alignItems: 'center' }}>{body('front')}{sides === 'both' && <Text style={T.caption}>Front</Text>}</View>}
        {sides === 'both' && showBack && <View style={{ alignItems: 'center' }}>{body('back')}<Text style={T.caption}>Back</Text></View>}
        {sides === 'auto' && !showFront && body('back')}
      </View>
      {legend && detail && (
        <View style={{ gap: 14 }}>
          {primary.length > 0 && <Detail color={HEAT.main} label="Main muscles" note="These do most of the work. This is where you should feel it." muscles={primary} />}
          {secondary.filter((m) => !primary.includes(m)).length > 0 && <Detail color={HEAT.assist} label="Also working" note="These help the movement and hold you steady." muscles={secondary.filter((m) => !primary.includes(m))} />}
        </View>
      )}
      {legend && !detail && (
        <View style={{ gap: 6 }}>
          {primary.length > 0 && <Legend color={HEAT.main} label="Main muscles" items={primary.map((m) => MUSCLE_NAME[m])} />}
          {secondary.length > 0 && <Legend color={HEAT.assist} label="Also working" items={secondary.map((m) => MUSCLE_NAME[m])} />}
        </View>
      )}
    </View>
  )
}

function Detail({ color, label, note, muscles }: { color: string; label: string; note: string; muscles: MuscleSlug[] }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <Text style={[T.body, { fontWeight: '700' }]}>{label}</Text>
      </View>
      <Text style={[T.caption, { marginTop: -4, marginLeft: 22 }]}>{note}</Text>
      {muscles.map((m) => (
        <View key={m} style={{ marginLeft: 22, gap: 1 }}>
          <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{MUSCLE_NAME[m]}</Text>
          <Text style={[T.caption, { lineHeight: 17 }]}>{MUSCLE_ROLE[m]}</Text>
        </View>
      ))}
    </View>
  )
}

function Legend({ color, label, items }: { color: string; label: string; items: string[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginTop: 4 }} />
      <Text style={[T.body, { flex: 1, lineHeight: 20 }]}><Text style={{ fontWeight: '700' }}>{label}: </Text>{items.join(', ')}</Text>
    </View>
  )
}
