import { Text, View } from 'react-native'
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter'
import { MUSCLE_NAME, type MuscleSlug } from '../data/exercises'
import { C, T } from '../theme'

const ALL_MUSCLES: MuscleSlug[] = ['abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids', 'forearm', 'gluteal', 'hamstring', 'lower-back', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back']
const OTHER_PARTS: Slug[] = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles']
const FRONT: MuscleSlug[] = ['chest', 'abs', 'obliques', 'biceps', 'quadriceps', 'deltoids', 'forearm', 'adductors', 'tibialis', 'calves']
const BACK: MuscleSlug[] = ['upper-back', 'lower-back', 'trapezius', 'triceps', 'gluteal', 'hamstring', 'calves', 'deltoids']

/** Anatomical front/back muscle map (react-native-body-highlighter, MIT). Primary = coral, secondary = peach. */
export function MuscleMap({ primary, secondary, gender = 'male', scale = 0.62, sides = 'both', legend = true }: {
  primary: MuscleSlug[]; secondary: MuscleSlug[]; gender?: 'male' | 'female'; scale?: number; sides?: 'both' | 'auto'; legend?: boolean
}) {
  // The artwork ships with its own dark greys, so every part gets an explicit sky-palette fill
  const worked = new Set<string>([...primary, ...secondary])
  const data: ExtendedBodyPart[] = [
    ...ALL_MUSCLES.filter((m) => !worked.has(m)).map((slug) => ({ slug, styles: { fill: '#CFE3F3' } })),
    ...OTHER_PARTS.map((slug) => ({ slug, styles: { fill: slug === 'hair' ? '#8DA0B8' : '#E4EFF8' } })),
    ...secondary.filter((m) => !primary.includes(m)).map((slug) => ({ slug, intensity: 1 })),
    ...primary.map((slug) => ({ slug, intensity: 2 })),
  ]
  const showFront = sides === 'both' || primary.some((m) => FRONT.includes(m))
  const showBack = sides === 'both' || !showFront || primary.some((m) => BACK.includes(m) && !FRONT.includes(m))
  const body = (side: 'front' | 'back') => (
    <Body data={data} side={side} gender={gender} scale={scale} colors={[C.dawn, C.coral]} border="none" />
  )
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: sides === 'both' ? 4 : 0 }}>
        {showFront && <View style={{ alignItems: 'center' }}>{body('front')}{sides === 'both' && <Text style={T.caption}>Front</Text>}</View>}
        {sides === 'both' && showBack && <View style={{ alignItems: 'center' }}>{body('back')}<Text style={T.caption}>Back</Text></View>}
        {sides === 'auto' && !showFront && body('back')}
      </View>
      {legend && (
        <View style={{ gap: 6 }}>
          {primary.length > 0 && <Legend color={C.coral} label="Main muscles" items={primary.map((m) => MUSCLE_NAME[m])} />}
          {secondary.length > 0 && <Legend color={C.dawn} label="Also working" items={secondary.map((m) => MUSCLE_NAME[m])} />}
        </View>
      )}
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
