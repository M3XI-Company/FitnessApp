import { Pressable, Text, View } from 'react-native'
import { REPORT_REASONS, type ReportReason } from '../../lib/buddies'
import { GOAL_LABEL, LEVEL_LABEL, TIME_LABEL, whereLine, type BuddyPerson } from '../../lib/buddyRules'
import { C, T } from '../../theme'
import { Button, Card, Icon, Pill, tap } from '../ui'

/** The round initial shown for a person. Breeze holds no photos of anyone. */
export function Initial({ name, size = 54 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '800', fontSize: size * 0.4, color: C.accent }}>{name[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  )
}

/** What one person shows another: who they are, where they train, when, and what Breeze made of the fit. */
export function PersonDetails({ p }: { p: BuddyPerson }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Initial name={p.name} />
        <View style={{ flex: 1 }}>
          <Text style={T.title2}>{p.name}, {p.age}</Text>
          <Text style={T.sub}>{whereLine(p)}</Text>
        </View>
      </View>
      {p.why ? (
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: C.accentSoft, borderRadius: 14, padding: 12 }}>
          <Icon name="breeze" size={18} color={C.accent} />
          <Text style={[T.body, { flex: 1, lineHeight: 21 }]}>{p.why}</Text>
        </View>
      ) : null}
      {p.bio ? <Text style={[T.body, { fontSize: 16, lineHeight: 24 }]}>{p.bio}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Pill>{GOAL_LABEL[p.goal] ?? 'Training'}</Pill>
        <Pill color={C.text2} bg={C.fill}>{LEVEL_LABEL[p.level] ?? p.level}</Pill>
        <Pill color={C.text2} bg={C.fill}>{`${p.days_per_week} days a week`}</Pill>
        {p.times.map((t) => <Pill key={t} color={C.text2} bg={C.fill}>{TIME_LABEL[t] ?? t}</Pill>)}
      </View>
    </View>
  )
}

/** Choosing why someone is being reported, or just blocking them. Either way they can no longer see or contact the person. */
export function ReportSheet({ name, onBlock, onReport, onCancel }: { name: string; onBlock: () => void; onReport: (r: ReportReason) => void; onCancel: () => void }) {
  return (
    <Card style={{ gap: 8 }}>
      <Text style={T.title3}>Block {name}</Text>
      <Text style={[T.sub, { lineHeight: 19 }]}>They will not be able to see you or message you again, and are not told. Choose a reason to report them to Breeze as well.</Text>
      {REPORT_REASONS.map((r) => (
        <Pressable key={r} onPress={() => { tap(); onReport(r) }} style={({ pressed }) => [{ padding: 14, borderRadius: 12, backgroundColor: C.fill }, pressed && { opacity: 0.7 }]}>
          <Text style={T.body}>Report: {r}</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Button small variant="ghost" title="Cancel" style={{ flex: 1 }} onPress={onCancel} />
        <Button small variant="dark" icon="ban-outline" title="Just block" style={{ flex: 1 }} onPress={onBlock} />
      </View>
    </Card>
  )
}
