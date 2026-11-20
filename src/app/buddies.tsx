import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ADULT_AGE } from '../lib/age'
import { BUDDY_ERROR, blockPerson, deleteMyProfile, findPeople, getMatches, getMyProfile, pauseMyProfile, reportPerson, saveMyProfile, swipe, type BuddyError, type BuddyMatch, type ReportReason } from '../lib/buddies'
import { BUDDY_LEVELS, BUDDY_TIMES, GOAL_LABEL, agoLine, joinBlocker, levelFromSets, shownName, type BuddyPerson, type BuddySetup, type BuddyTime } from '../lib/buddyRules'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { Initial, PersonDetails, ReportSheet } from '../components/social/BuddyParts'
import { Button, Card, Field, Icon, IconTile, Pill, Segmented, SheetHeader, Stepper, success, tap, type IconName } from '../components/ui'

const SAFETY_RULES: [IconName, string][] = [
  ['business-outline', 'Meet at your gym or another busy, staffed public place. Never at home.'],
  ['people-outline', 'Tell a friend who you are meeting, where and when.'],
  ['lock-closed-outline', 'Do not share your home address, workplace or bank details.'],
  ['chatbubbles-outline', 'Keep the conversation in Breeze until you trust someone. Leave if you feel uncomfortable.'],
  ['flag-outline', 'Report anything inappropriate. Breeze is for training partners, not dating.'],
]

/** One person at a time. Swipe right or press Yes to say you would train with them; left or No to pass. */
function SwipeCard({ person, onDecide, onReport }: { person: BuddyPerson; onDecide: (liked: boolean) => void; onReport: () => void }) {
  const [x] = useState(() => new Animated.Value(0))
  const fly = useCallback((liked: boolean) => {
    Animated.timing(x, { toValue: liked ? 480 : -480, duration: 170, useNativeDriver: true }).start(() => onDecide(liked))
  }, [x, onDecide])
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_e, g) => x.setValue(g.dx),
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 110) fly(true)
      else if (g.dx < -110) fly(false)
      else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
    },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: true }).start() },
  }), [x, fly])
  const rotate = x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-8deg', '0deg', '8deg'] })
  const yes = x.interpolate({ inputRange: [0, 90], outputRange: [0, 1], extrapolate: 'clamp' })
  const no = x.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  return (
    <View style={{ gap: 14 }}>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }, { rotate }] }}>
        <Card style={{ gap: 12 }}>
          <PersonDetails p={person} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 14, right: 14, opacity: yes }}><Pill color="#fff" bg={C.green}>Yes</Pill></Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 14, right: 14, opacity: no }}><Pill color="#fff" bg={C.text2}>No</Pill></Animated.View>
        </Card>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="No" icon="close" variant="ghost" style={{ flex: 1 }} onPress={() => fly(false)} />
        <Button title="Yes, train together" icon="checkmark" style={{ flex: 2 }} onPress={() => fly(true)} />
      </View>
      <Pressable onPress={() => { tap(); onReport() }} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }} accessibilityLabel={`Block or report ${person.name}`}>
        <Text style={[T.sub, { color: C.text3 }]}>Block or report</Text>
      </Pressable>
    </View>
  )
}

/**
 * Training partners. Someone describes who they would like to train with,
 * Breeze shows the nearest people who fit, and they say yes or no to each.
 * Two people who both said yes are matched and can message each other.
 */
export default function Buddies() {
  const { state, dispatch } = useStore()
  const p = state.profile
  const blocker = joinBlocker(p)
  const [stage, setStage] = useState<'loading' | 'setup' | 'ready'>('loading')
  const [joined, setJoined] = useState(false)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState<'find' | 'matches'>('find')
  const [people, setPeople] = useState<BuddyPerson[] | null>(null)
  const [byDescription, setByDescription] = useState(false)
  const [matches, setMatches] = useState<BuddyMatch[]>([])
  const [error, setError] = useState<BuddyError | null>(null)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [matched, setMatched] = useState<{ id: string; name: string } | null>(null)
  const [setup, setSetup] = useState<BuddySetup>(() => state.buddy ?? { bio: '', lookingFor: '', times: ['evening'], level: levelFromSets(state.sets), daysPerWeek: 3 })
  const ok = !blocker && !!state.buddySafetyAt

  const loadPeople = useCallback(async () => {
    setPeople(null)
    const r = await findPeople()
    if (r.ok) { setPeople(r.data.people); setByDescription(r.data.by_description); setError(null) } else { setPeople([]); setError(r.error) }
  }, [])
  const loadMatches = useCallback(async () => {
    const r = await getMatches()
    if (r.ok) setMatches(r.data.matches)
  }, [])

  // on opening: is there a profile already?
  useEffect(() => {
    if (!ok) return
    let live = true
    getMyProfile().then((r) => {
      if (!live) return
      if (!r.ok) { setError(r.error); setStage('setup'); return }
      const mine = r.data.profile
      if (!mine) { setStage('setup'); return }
      setJoined(true); setPaused(!mine.active); setStage('ready')
      loadPeople()
    })
    return () => { live = false }
  }, [ok, loadPeople])
  // matches are looked at again each time the screen comes back into view, so a new message shows
  useFocusEffect(useCallback(() => { if (ok && joined) loadMatches() }, [ok, joined, loadMatches]))

  const save = async () => {
    setBusy(true); setError(null)
    dispatch({ type: 'buddy', setup })
    const r = await saveMyProfile(p, setup)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    success(); setJoined(true); setPaused(false); setStage('ready'); setTab('find'); loadPeople(); loadMatches()
  }
  const decide = async (person: BuddyPerson, liked: boolean) => {
    setPeople((list) => (list ?? []).filter((x) => x.id !== person.id))
    setReporting(false)
    const r = await swipe(person.id, liked)
    if (r.ok && r.data.matched && r.data.match) { success(); setMatched({ id: r.data.match, name: r.data.name ?? person.name }); loadMatches() }
  }
  const hide = async (person: BuddyPerson, reason?: ReportReason) => {
    setPeople((list) => (list ?? []).filter((x) => x.id !== person.id))
    setReporting(false)
    await (reason ? reportPerson(person.id, reason) : blockPerson(person.id))
  }
  const toggleTime = (t: BuddyTime) => setSetup((s) => ({ ...s, times: s.times.includes(t) ? (s.times.length > 1 ? s.times.filter((x) => x !== t) : s.times) : [...s.times, t] }))

  const body = () => {
    // 18 and over only: nobody younger sees or appears in partner search
    if (blocker === 'age') return (
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        <IconTile icon="lock-closed" size={52} color={C.skyLight} bg={C.night} />
        <Text style={[T.title2, { textAlign: 'center' }]}>Training partners are 18+</Text>
        <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>Finding a partner and messaging open when you turn {ADULT_AGE}. Workouts, meals and the coach are all open to you now.</Text>
      </Card>
    )
    if (!state.buddySafetyAt) return (
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="shield-checkmark" size={46} color={C.skyLight} bg={C.night} />
          <View style={{ flex: 1 }}><Text style={T.title2}>Train safely</Text><Text style={T.sub}>Read this before meeting anyone from Breeze</Text></View>
        </View>
        {SAFETY_RULES.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Icon name={icon} size={20} color={C.accent} /><Text style={[T.body, { flex: 1, fontSize: 16, lineHeight: 23 }]}>{text}</Text>
          </View>
        ))}
        <Text style={[T.caption, { lineHeight: 17 }]}>Other people see your first name, age, gym and what you write here. They see a rounded distance, never where you are. Breeze holds no photos.</Text>
        <Button title="I understand" onPress={() => dispatch({ type: 'buddySafety' })} />
      </Card>
    )
    if (blocker === 'gym') return (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconTile icon="business-outline" size={46} />
          <View style={{ flex: 1 }}><Text style={T.title2}>Where do you train?</Text><Text style={T.sub}>Breeze finds the people nearest your gym</Text></View>
        </View>
        <Text style={[T.body, { lineHeight: 22 }]}>Pick your gym from the search so Breeze knows where to look. Only the gym is used, never where you live or where your phone is.</Text>
        <Button title="Choose my gym" icon="search" onPress={() => router.push('/gym')} />
      </Card>
    )
    if (stage === 'loading') return <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={C.sky} /></View>

    if (stage === 'setup') return (
      <>
        <Card style={{ gap: 14 }}>
          <View>
            <Text style={T.title2}>{joined ? 'Your partner profile' : 'Find a training partner'}</Text>
            <Text style={[T.sub, { marginTop: 4, lineHeight: 19 }]}>Shown to others as {shownName(p.name) || 'your first name'}, {p.age}, {GOAL_LABEL[p.goal].toLowerCase()}, at {p.gym}.</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={T.headline}>Who would you like to train with?</Text>
            <Field value={setup.lookingFor} onChangeText={(t) => setSetup((s) => ({ ...s, lookingFor: t.slice(0, 280) }))} multiline placeholder="In your own words. For example: someone patient who lifts before work and can show me the barbell lifts."
              style={{ height: 110, paddingTop: 14, textAlignVertical: 'top', lineHeight: 22 }} />
            <Text style={T.caption}>Breeze reads this and puts the people who fit it first.</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={T.headline}>About you</Text>
            <Field value={setup.bio} onChangeText={(t) => setSetup((s) => ({ ...s, bio: t.slice(0, 280) }))} multiline placeholder="What you train, what you are working on, what you are like to train with."
              style={{ height: 96, paddingTop: 14, textAlignVertical: 'top', lineHeight: 22 }} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={T.headline}>When can you train?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BUDDY_TIMES.map((t) => {
                const on = setup.times.includes(t.value)
                return (
                  <Pressable key={t.value} onPress={() => { tap(); toggleTime(t.value) }} accessibilityState={{ selected: on }} style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? C.night : C.fill }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: on ? C.skyLight : C.text2 }}>{t.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={T.headline}>Your experience</Text>
            <Segmented value={setup.level} options={BUDDY_LEVELS} onChange={(level) => setSetup((s) => ({ ...s, level }))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={T.headline}>Days a week</Text>
            <Stepper value={setup.daysPerWeek} min={1} onChange={(v) => setSetup((s) => ({ ...s, daysPerWeek: Math.min(7, Math.max(1, Math.round(v))) }))} />
          </View>
          {error && <Text style={[T.sub, { color: C.red }]}>{BUDDY_ERROR[error]}</Text>}
          <Button title={busy ? 'Saving…' : joined ? 'Save' : 'Show me people'} disabled={busy} onPress={save} />
          {joined && <Button title="Cancel" variant="ghost" onPress={() => { setError(null); setStage('ready') }} />}
        </Card>
        {joined && (
          <Card style={{ gap: 10 }}>
            <Text style={T.headline}>{paused ? 'You are hidden' : 'Take a break'}</Text>
            <Text style={[T.sub, { lineHeight: 19 }]}>{paused ? 'Nobody new is shown your profile. Your matches and messages are still here.' : 'Hide your profile from new people without losing your matches.'}</Text>
            <Button small variant="tinted" title={paused ? 'Show my profile again' : 'Hide my profile'} onPress={async () => { const r = await pauseMyProfile(!paused); if (r.ok) setPaused(!paused); else setError(r.error) }} />
            <Button small variant="ghost" icon="trash-outline" title="Leave and delete everything" onPress={async () => {
              const r = await deleteMyProfile()
              if (!r.ok) { setError(r.error); return }
              setJoined(false); setMatches([]); setPeople(null); setStage('setup')
            }} />
            <Text style={T.caption}>Leaving deletes your profile, your matches and every message in them, for both of you.</Text>
          </Card>
        )}
      </>
    )

    const person = people?.[0]
    return (
      <>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'find', label: 'Find' }, { value: 'matches', label: matches.length ? `Matches (${matches.length})` : 'Matches' }]} />
        {matched && (
          <Card style={{ gap: 10, backgroundColor: C.night }}>
            <Text style={[T.title3, { color: C.cloud }]}>You and {matched.name} both said yes</Text>
            <Text style={{ color: C.skyLight, fontSize: 15, lineHeight: 21 }}>You can message each other now, and ask Breeze for a session to do together.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="ghost" title="Later" style={{ flex: 1 }} onPress={() => setMatched(null)} />
              <Button small title="Say hello" icon="chatbubbles-outline" style={{ flex: 2 }} onPress={() => { const id = matched.id; setMatched(null); router.push({ pathname: '/buddy/[id]', params: { id } }) }} />
            </View>
          </Card>
        )}
        {tab === 'find' ? (
          <>
            {paused && <Card tight style={{ backgroundColor: C.accentSoft }}><Text style={T.sub}>Your profile is hidden, so nobody new can say yes to you. Change this under Edit profile.</Text></Card>}
            {people === null ? (
              <View style={{ paddingVertical: 50, alignItems: 'center', gap: 12 }}><ActivityIndicator color={C.sky} /><Text style={T.sub}>Breeze is looking near {p.gym}…</Text></View>
            ) : reporting && person ? (
              <ReportSheet name={person.name} onCancel={() => setReporting(false)} onBlock={() => hide(person)} onReport={(r) => hide(person, r)} />
            ) : person ? (
              <>
                <Text style={[T.sub, { marginHorizontal: 4 }]}>{byDescription ? 'In the order that best fits what you asked for.' : 'Nearest and best fit first.'} {people.length > 1 ? `${people.length} people to look at.` : 'One person to look at.'}</Text>
                <SwipeCard key={person.id} person={person} onDecide={(liked) => decide(person, liked)} onReport={() => setReporting(true)} />
              </>
            ) : (
              <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
                <IconTile icon="people-outline" size={52} />
                <Text style={[T.title3, { textAlign: 'center' }]}>{error ? 'Could not look just now' : 'Nobody new nearby yet'}</Text>
                <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>{error ? BUDDY_ERROR[error] : `You have seen everyone within 40 km of ${p.gym}. People who join later will show up here, and anyone who says yes to you will find you.`}</Text>
                <Button small variant="tinted" icon="refresh" title="Look again" onPress={loadPeople} />
              </Card>
            )}
          </>
        ) : matches.length ? (
          matches.map((m) => (
            <Card key={m.id} tight onPress={() => router.push({ pathname: '/buddy/[id]', params: { id: m.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Initial name={m.person.name} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={T.headline} numberOfLines={1}>{m.person.name}</Text>
                <Text style={[T.sub, m.unread > 0 && { color: C.text, fontWeight: '700' }]} numberOfLines={1}>{m.last ? `${m.last.mine ? 'You: ' : ''}${m.last.text}` : 'You matched. Say hello.'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={T.caption}>{agoLine(m.last?.at ?? m.since)}</Text>
                {m.unread > 0 && <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{m.unread}</Text></View>}
              </View>
            </Card>
          ))
        ) : (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 26 }}>
            <IconTile icon="chatbubbles-outline" size={52} />
            <Text style={[T.title3, { textAlign: 'center' }]}>No matches yet</Text>
            <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>When you and someone else both say yes, they appear here and you can message each other.</Text>
          </Card>
        )}
        <Button small variant="ghost" icon="create-outline" title="Edit profile" onPress={() => { setError(null); setStage('setup') }} style={{ marginTop: 6 }} />
      </>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Training partners" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
        {body()}
      </ScrollView>
    </View>
  )
}
