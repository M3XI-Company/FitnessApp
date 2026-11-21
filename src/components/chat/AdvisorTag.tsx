import { Text, View } from 'react-native'
import { ADVISORS, type Advisor } from '../../lib/advisors'
import { C } from '../../theme'

export const ADVISOR_COLOR: Record<Advisor, string> = { performance: C.accent, lifestyle: C.coral }

/** Who is speaking: the coach's initial in their colour, their name and what they look after. */
export function AdvisorTag({ who, center, small }: { who: Advisor; center?: boolean; small?: boolean }) {
  const a = ADVISORS[who]
  const d = small ? 18 : 24
  return (
    <View accessibilityLabel={`${a.name}, ${a.role}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: center ? 'center' : 'flex-start' }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: ADVISOR_COLOR[who], alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: small ? 10 : 12 }}>{a.name[0]}</Text>
      </View>
      <Text style={{ fontSize: small ? 12 : 13, fontWeight: '800', color: C.text, letterSpacing: 0.2 }}>{a.name}</Text>
      <Text style={{ fontSize: small ? 11 : 12, fontWeight: '600', color: C.text3 }}>{a.role}</Text>
    </View>
  )
}
