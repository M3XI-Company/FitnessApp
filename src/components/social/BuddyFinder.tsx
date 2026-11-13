import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useStore } from '../../lib/store'
import { BUDDIES, type Buddy } from '../../data/buddies'
import { C, T } from '../../theme'
import { Button, Card, Chips, Icon, IconTile, Pill, Segmented, tap, type IconName } from '../ui'
import { ADULT_AGE, canDiscoverBuddies, sameAgeBand } from '../../lib/age'

type GoalF = Buddy['goal'] | 'Any'
type LevelF = Buddy['level'] | 'Any'
type TimeF = Buddy['times'][number] | 'Any'

const SAFETY_RULES: [IconName, string][] = [
  ['business-outline', 'Meet at your gym or another busy, staffed public place. Never at home.'],
  ['people-outline', 'Tell a friend who you are meeting, where and when.'],
  ['lock-closed-outline', "Don't share your home address, workplace or financial details."],
  ['chatbubbles-outline', 'Keep conversations in Breeze until you trust someone. Leave if you feel uncomfortable.'],
  ['flag-outline', 'Report anything inappropriate. Breeze is for training partners, not dating.'],
]
const REPORT_REASONS = ['Romantic or sexual contact', 'Harassment or threats', 'Fake profile', 'Seems under 18', 'Unsafe behaviour', 'Other']

/** 18+ training-partner discovery with safety guidelines, block and report (sample profiles until the backend exists) */
export function BuddyFinder() {
  const { state, dispatch } = useStore()
  const age = state.profile.age
  const myGoal: Buddy['goal'] = state.profile.goal === 'lose' ? 'Lose fat' : state.profile.goal === 'gain' ? 'Build muscle' : 'Get fit'
  const myLevel: Buddy['level'] = state.sets.length > 150 ? 'Advanced' : state.sets.length > 30 ? 'Intermediate' : 'Beginner'
  const [goal, setGoal] = useState<GoalF>('Any')
  const [level, setLevel] = useState<LevelF>('Any')
  const [time, setTime] = useState<TimeF>('Any')
  const [km, setKm] = useState<'1' | '3' | '5'>('5')
  const [menu, setMenu] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // 18+ only. Under-18s never see (or appear in) buddy discovery.
  if (!canDiscoverBuddies(age)) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 12 }}>
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
          <IconTile icon="lock-closed" size={52} color={C.goldLight} bg={C.ink} />
          <Text style={[T.title2, { textAlign: 'center' }]}>Gym buddies are 18+</Text>
          <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>Finding training partners and messaging unlock when you turn {ADULT_AGE}. You can still use workouts, nutrition and the AI trainer.</Text>
        </Card>
      </ScrollView>
    )
  }

  // First visit: meeting-safety guidelines must be accepted
  if (!state.buddySafetyAt) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 12 }}>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon="shield-checkmark" size={46} color={C.goldLight} bg={C.ink} />
            <View style={{ flex: 1 }}><Text style={T.title2}>Train safely</Text><Text style={T.sub}>Read before meeting anyone from Breeze</Text></View>
          </View>
          {SAFETY_RULES.map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name={icon} size={20} color={C.accent} /><Text style={[T.body, { flex: 1, lineHeight: 21 }]}>{text}</Text>
            </View>
          ))}
          <Text style={[T.caption, { lineHeight: 17 }]}>Breeze shows approximate distance only and never shares your exact location. People you block can no longer see or contact you.</Text>
          <Button title="I understand — show buddies" onPress={() => dispatch({ type: 'buddySafety' })} />
        </Card>
      </ScrollView>
    )
  }

  const match = (b: Buddy) => {
    let s = 50
    if (b.goal === myGoal) s += 25
    if (b.level === myLevel) s += 15
    s += Math.max(0, 10 - b.km * 2)
    return Math.min(99, Math.round(s))
  }
  const list = BUDDIES
    .filter((b) => sameAgeBand(age, b.age) && !state.blocked.includes(b.id))
    .filter((b) => (goal === 'Any' || b.goal === goal) && (level === 'Any' || b.level === level) && (time === 'Any' || b.times.includes(time)) && b.km <= +km)
    .sort((a, b) => match(b) - match(a))

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: C.ink, borderRadius: 16, padding: 12 }}>
        <Icon name="shield-checkmark" size={20} color={C.goldLight} />
        <Text style={{ color: C.cream, fontSize: 13, flex: 1, lineHeight: 18 }}>Meet in public at the gym and tell a friend. Breeze is for training partners — not dating.</Text>
      </View>
      {notice && <Card tight style={{ backgroundColor: C.accentSoft }}><Text style={T.sub}>{notice}</Text></Card>}
      <Text style={[T.sub, { marginLeft: 4 }]}>Matched to you: {myGoal} · {myLevel}</Text>
      <Chips value={goal} onChange={setGoal} items={(['Any', 'Lose fat', 'Build muscle', 'Get fit', 'Run'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any goal' : v }))} />
      <Chips value={level} onChange={setLevel} items={(['Any', 'Beginner', 'Intermediate', 'Advanced'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any level' : v }))} />
      <Chips value={time} onChange={setTime} items={(['Any', 'Morning', 'Lunch', 'Evening'] as const).map((v) => ({ value: v, label: v === 'Any' ? 'Any time' : v }))} />
      <Segmented value={km} onChange={setKm} options={[{ value: '1', label: '< 1 km' }, { value: '3', label: '< 3 km' }, { value: '5', label: '< 5 km' }]} />
      <Text style={[T.sub, { marginLeft: 4, marginTop: 4 }]}>{list.length} training partners nearby</Text>
      {list.map((b) => {
        const connected = state.buddies.includes(b.id)
        const m = match(b)
        return (
          <Card key={b.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28 }}>{b.avatar}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={T.title3}>{b.name}</Text>
                <Text style={T.sub}>{b.gym} · about {Math.max(1, Math.round(b.km))} km</Text>
              </View>
              <View style={{ alignItems: 'center' }}><Text style={[T.title3, { color: m >= 80 ? C.accent : C.text2 }]}>{m}%</Text><Text style={T.caption}>match</Text></View>
              <Pressable onPress={() => { tap(); setMenu(menu === b.id ? null : b.id); setReporting(null) }} hitSlop={8} accessibilityLabel={`Safety options for ${b.name}`}><Icon name="ellipsis-horizontal" color={C.text2} /></Pressable>
            </View>
            <Text style={T.body}>{b.bio}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill>{b.goal}</Pill><Pill color={C.text2} bg={C.fill}>{b.level}</Pill>
              {b.times.map((t) => <Pill key={t} color={C.text2} bg={C.fill}>{t}</Pill>)}
              <Pill color={C.accent} bg="#F8EBD8">{`🔥 ${b.streak} days`}</Pill>
            </View>
            {menu === b.id && !reporting && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small variant="ghost" icon="ban-outline" title="Block" style={{ flex: 1 }} onPress={() => { dispatch({ type: 'block', id: b.id }); setMenu(null); setNotice(`${b.name} is blocked. They can no longer see or contact you.`) }} />
                <Button small variant="ghost" icon="flag-outline" title="Report" style={{ flex: 1 }} onPress={() => setReporting(b.id)} />
              </View>
            )}
            {reporting === b.id && (
              <View style={{ gap: 8 }}>
                <Text style={T.headline}>Why are you reporting {b.name}?</Text>
                {REPORT_REASONS.map((r) => (
                  <Pressable key={r} onPress={() => { tap(); dispatch({ type: 'report', targetId: b.id, reason: r }); setReporting(null); setMenu(null); setNotice(`Thanks — our moderation team will review your report about ${b.name}. They've also been blocked for you.`) }}
                    style={({ pressed }) => [{ padding: 12, borderRadius: 12, backgroundColor: C.fill }, pressed && { opacity: 0.7 }]}>
                    <Text style={T.body}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Button small title={connected ? 'Request sent' : 'Ask to train together'} icon={connected ? 'checkmark' : 'barbell-outline'} variant={connected ? 'tinted' : 'primary'} onPress={() => dispatch({ type: 'toggleBuddy', id: b.id })} />
          </Card>
        )
      })}
      {!list.length && <Card><Text style={[T.sub, { textAlign: 'center' }]}>No training partners match these filters. Try widening the distance.</Text></Card>}
    </ScrollView>
  )
}
