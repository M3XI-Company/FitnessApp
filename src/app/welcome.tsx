import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BodyScanStep } from '../components/onboarding/BodyScanStep'
import { MIN_AGE } from '../lib/age'
import { askCoach } from '../lib/coachApi'
import { uid } from '../lib/date'
import { thinkingLine } from '../lib/chat'
import { askInterview, heardTags, interviewConfigured, knownFrom, understand, type HeardProfile, type InterviewError, type InterviewTurn, type ProfileField } from '../lib/interview'
import { addMemories, memoryOf, notesToMemories } from '../lib/memory'
import { computeTargets } from '../lib/nutrition'
import { WEEKDAYS, buildRoutine } from '../lib/routine'
import { useStore } from '../lib/store'
import type { Activity, GoalType, Profile, WeeklyRoutine } from '../lib/types'
import { canListen, listen, speak, stopSpeaking, type Listening } from '../lib/voice'
import { C, T, shadow } from '../theme'
import { SkyOrb, type OrbMode } from '../components/SkyOrb'
import { VoiceBar } from '../components/VoiceBar'
import { Button, Card, Icon, Stepper, success, tap } from '../components/ui'

type Phase = 'intro' | 'talk' | 'review' | 'underage' | 'scan' | 'plan'
type Mode = 'thinking' | 'speaking' | 'listening' | 'waiting'

const ERRORS: Record<InterviewError, string> = {
  not_configured: 'Talking to Breeze is not set up in this build.',
  monthly_limit: 'You have used this month’s conversations with Breeze.',
  declined: 'I could not carry on with that. Let’s fill in the basics instead.',
  offline: 'I can’t reach Breeze. Check your connection and try again.',
  busy: 'Breeze is busy right now. Try again in a moment.',
  failed: 'Something went wrong on my side. Try again.',
}
const GOALS: { v: GoalType; t: string }[] = [{ v: 'lose', t: 'Lose weight' }, { v: 'maintain', t: 'Stay the same' }, { v: 'gain', t: 'Build muscle' }]
const ACTIVITIES: { v: Activity; t: string }[] = [{ v: 'sedentary', t: 'Mostly sitting' }, { v: 'light', t: 'Lightly active' }, { v: 'moderate', t: 'Moderately active' }, { v: 'active', t: 'Very active' }, { v: 'athlete', t: 'Athlete' }]

/**
 * First run: Breeze and the user talk. Breeze asks one question at a time out
 * loud and listens to the answer; where the phone cannot listen, answers are
 * typed and Breeze still speaks. Then the user checks what was heard, can add
 * a body photo, and gets a plan built from the conversation.
 */
export default function Welcome() {
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  // Settings opens the details on their own (`edit`), to correct one by hand without a conversation
  const { edit } = useLocalSearchParams<{ edit?: string }>()
  const editing = edit === '1'
  const [phase, setPhase] = useState<Phase>(editing ? 'review' : 'intro')
  const [accepted, setAccepted] = useState(!!state.profile.healthNoticeAt)
  const hears = canListen()
  // someone who has already set up: the conversation picks up from what Breeze knows
  const returning = state.profile.onboarded
  const known = useRef(returning ? knownFrom(state.profile, memoryOf(state).map((m) => m.text)) : undefined)

  // ---- the conversation ----
  const turns = useRef<InterviewTurn[]>([])
  const alive = useRef(true)
  const ear = useRef<Listening | null>(null)
  const [mode, setMode] = useState<Mode>('thinking')
  const [line, setLine] = useState('')
  const [partial, setPartial] = useState('')
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState<HeardProfile>()
  const [notes, setNotes] = useState('')
  const [typing, setTyping] = useState(!hears)
  const typingRef = useRef(typing)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<InterviewError | null>(null)
  // what Breeze is working out before it speaks, shown while it thinks
  const [thought, setThought] = useState('')
  const [draft, setDraft] = useState<Profile>(state.profile)
  const [missing, setMissing] = useState<ProfileField[]>([])

  useEffect(() => () => { alive.current = false; ear.current?.cancel(); stopSpeaking() }, [])
  useEffect(() => { typingRef.current = typing }, [typing])

  const toReview = useCallback((h: HeardProfile | undefined, n: string) => {
    ear.current?.cancel(); ear.current = null
    stopSpeaking()
    // a new user starts from a blank name, not the placeholder one
    const u = understand({ ...state.profile, name: state.profile.onboarded ? state.profile.name : '' }, h, n)
    setDraft(u.profile); setMissing(u.missing)
    setPhase(u.underAge ? 'underage' : 'review')
  }, [state.profile])

  // ask for the next thing to say, say it, then listen
  const next = useCallback(async () => {
    setMode('thinking'); setError(null); setThought('')
    let speaking: Promise<void> | null = null
    const res = await askInterview(turns.current, known.current, {
      thinking: (t) => { if (alive.current && !speaking) setThought(thinkingLine(t, 110)) },
      // the words arrive before the rest of the answer: start talking straight away
      say: (say) => {
        if (!alive.current || speaking) return
        setThought(''); setLine(say); setPartial(''); setMode('speaking')
        speaking = speak(say)
      },
    })
    if (!alive.current) return
    setThought('')
    if (!res.ok) { stopSpeaking(); setError(res.error); setMode('waiting'); return }
    const r = res.reply
    turns.current.push({ role: 'coach', text: r.say })
    setLine(r.say); setPartial(''); setHeard(r.profile); setNotes(r.notes)
    if (!speaking) { setMode('speaking'); speaking = speak(r.say) }
    await speaking
    if (!alive.current) return
    if (r.done) { toReview(r.profile, r.notes); return }
    hear()
    // `hear` and `answer` are stable for the life of the screen (they only touch refs and setters)
  }, [toReview]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (text: string) => {
    const said = text.trim()
    if (!said) return
    turns.current.push({ role: 'user', text: said })
    setPartial(said); setTyped('')
    next()
  }

  function hear() {
    if (typingRef.current) { setMode('waiting'); return }
    setPartial(''); setLevel(0); setMode('listening')
    const l = listen(setPartial, setLevel)
    ear.current = l
    l.result.then((text) => {
      if (!alive.current || ear.current !== l) return
      ear.current = null
      if (text) answer(text); else setMode('waiting')
    })
  }

  const start = () => { tap(); setPhase('talk'); next() }
  const interrupt = () => { stopSpeaking() }

  // ---- the plan ----
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null)
  const [planNote, setPlanNote] = useState('')
  const buildPlan = async (p: Profile) => {
    setPhase('plan'); setRoutine(null)
    speak('Give me a moment while I build your plan.')
    // what was said becomes part of what Breeze remembers, now that the user has confirmed it
    const learned = notesToMemories(p.notes)
    if (learned.length) dispatch({ type: 'remember', texts: learned })
    const draftState = { ...state, profile: p, targets: computeTargets(p), chat: [], memory: addMemories(memoryOf(state), learned) }
    const ask = returning
      ? 'We have just talked things through. Update my weekly routine and my meals for the coming week for what has changed, and keep what is working.'
      : 'Build my first weekly routine and a meal plan for the coming week around everything you know about me.'
    const res = await askCoach(draftState, [{ id: uid(), role: 'user', text: ask }])
    if (!alive.current) return
    if (res.ok && res.memory.remember.length) dispatch({ type: 'remember', texts: res.memory.remember })
    const made = res.ok && res.message.routine ? res.message.routine : buildRoutine(p)
    if (res.ok && res.message.meals) dispatch({ type: 'mealPlan', days: res.message.meals })
    dispatch({ type: 'routine', routine: made })
    setRoutine(made)
    // the first paragraph is the summary; the rest is detail the chat can give later
    const say = res.ok && res.message.routine ? res.message.text.split('\n\n')[0].trim() : 'Here is a starting routine built from your goal and activity level. You can change any of it by asking me.'
    setPlanNote(say)
    speak(say)
  }
  const finish = () => {
    stopSpeaking()
    dispatch({ type: 'profile', profile: { ...draft, notes: undefined, age: Math.max(MIN_AGE, draft.age), onboarded: true, healthNoticeAt: draft.healthNoticeAt ?? new Date().toISOString() } })
    dispatch({ type: 'newChat' })
    success()
    router.replace('/')
  }

  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }))
  const tags = heardTags(heard)
  // with no conversation behind it there is nothing that was not heard
  const flagged = (f: ProfileField) => turns.current.length > 0 && missing.includes(f)
  const pad = { paddingTop: insets.top + 12, paddingBottom: Math.max(16, insets.bottom + 10), paddingHorizontal: 22 }

  if (phase === 'intro') {
    return (
      <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 }}>
          <SkyOrb size={230} />
          <View style={{ gap: 10, alignItems: 'center' }}>
            <Text style={[T.largeTitle, { textAlign: 'center' }]}>{returning ? 'Let’s catch up' : 'Hi, I’m Breeze'}</Text>
            <Text style={[T.body, { color: C.text2, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 320 }]}>
              {returning ? (hears ? 'Tell me what has changed or what is not working, out loud. I will update your plan around it.' : 'Tell me what has changed or what is not working. I ask out loud, you type, and I update your plan around it.') : hears ? 'Let’s talk for a couple of minutes. I ask, you answer out loud, and I build your plan from what you tell me.' : 'Let’s talk for a couple of minutes. I ask out loud, you type your answers, and I build your plan from what you tell me.'}
            </Text>
          </View>
        </View>
        <Pressable onPress={() => { tap(); setAccepted(!accepted) }} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} style={[{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#fff', marginBottom: 12 }, shadow]}>
          <Icon name={accepted ? 'checkbox' : 'square-outline'} size={24} color={accepted ? C.night : C.text3} />
          <Text style={[T.caption, { flex: 1, lineHeight: 17 }]}>
            <Text style={{ fontWeight: '700', color: C.text }}>Health and safety. </Text>
            Breeze gives general fitness and nutrition guidance, not medical advice. Stop if you feel pain, and check with a professional if you have a health condition. Breeze is for ages {MIN_AGE} and over. What you say is sent as text to build your plan and is not stored.
          </Text>
        </Pressable>
        <Button variant="dark" icon={hears ? 'sparkles' : 'chatbubble-ellipses-outline'} title={hears ? 'Start talking' : 'Start'} disabled={!accepted || !interviewConfigured()} onPress={start} />
        <Pressable onPress={() => { tap(); if (returning) router.back(); else toReview(undefined, '') }} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 14 }}>
          <Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>{returning ? 'Not now' : interviewConfigured() ? 'I can’t talk right now' : 'Set up without the conversation'}</Text>
        </Pressable>
      </View>
    )
  }

  if (phase === 'talk') {
    return (
      <KeyboardAvoidingView style={[{ flex: 1, backgroundColor: '#F7F8FA' }, pad]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable focusable={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34 }} onPress={mode === 'speaking' ? interrupt : undefined} accessibilityLabel={mode === 'speaking' ? 'Breeze is speaking. Tap to skip ahead.' : undefined}>
          <SkyOrb size={250} mode={ORB_MODE[mode]} level={level} />
          <View style={{ minHeight: 150, maxWidth: 340, gap: 12, alignItems: 'center' }}>
            {mode === 'thinking' ? (
              // Breeze's thinking, as it happens
              <Text accessibilityLabel={`Breeze is thinking: ${thought}`} style={[T.sub, { textAlign: 'center', fontStyle: 'italic', lineHeight: 21, color: C.text3 }]} numberOfLines={4}>{thought || 'Thinking\u2026'}</Text>
            ) : mode === 'listening' ? (
              <Text style={[T.body, { textAlign: 'center', fontSize: 18, lineHeight: 25, color: partial ? C.text : C.text3 }]}>{partial || 'Listening\u2026'}</Text>
            ) : (
              <Text style={[T.body, { textAlign: 'center', fontSize: 19, lineHeight: 27, color: C.text }]}>{line}</Text>
            )}
            {!!error && <Text style={[T.sub, { color: C.red, textAlign: 'center' }]}>{ERRORS[error]}</Text>}
            {/* what has been understood so far, quietly */}
            {tags.length > 0 && <Text accessibilityLabel={`Understood so far: ${tags.join(', ')}`} style={[T.caption, { textAlign: 'center', color: C.text3 }]}>{tags.join('  \u00b7  ')}</Text>}
          </View>
        </Pressable>
        {error && error !== 'not_configured' && error !== 'monthly_limit' && (
          <Pressable onPress={() => next()} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 12 }}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>Try again</Text></Pressable>
        )}
        <VoiceBar text={typed} onChangeText={setTyped} onSend={() => { stopSpeaking(); answer(typed) }} placeholder={hears ? 'Or type your answer' : 'Type your answer'} editable={mode !== 'thinking'}
          mic={!hears ? 'off' : mode === 'listening' ? 'listening' : mode === 'waiting' ? 'ready' : 'busy'}
          onMic={() => { setTyping(false); typingRef.current = false; if (mode === 'listening') ear.current?.stop(); else hear() }}
          onClose={() => toReview(heard, notes)} closeLabel="Finish the conversation" />
      </KeyboardAvoidingView>
    )
  }

  if (phase === 'underage') {
    return (
      <View style={[{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', gap: 14 }, pad]}>
        <Text style={T.title1}>Breeze is for ages {MIN_AGE} and over</Text>
        <Text style={[T.body, { color: C.text2, lineHeight: 23 }]}>Thanks for talking with me. I can&apos;t build a plan for anyone under {MIN_AGE}. A parent, a PE teacher or a coach at a local club is a good place to start.</Text>
        <Button variant="ghost" title="I gave the wrong age" onPress={() => { setMissing((m) => [...new Set<ProfileField>([...m, 'age'])]); setPhase('review') }} style={{ marginTop: 10 }} />
      </View>
    )
  }

  if (phase === 'review') {
    return (
      <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={T.title1}>{editing ? 'Your details' : turns.current.length ? 'Here’s what I heard' : 'A few details'}</Text>
          <Text style={[T.sub, { marginTop: -6 }]}>{editing ? 'Change anything that is out of date. Your targets are recalculated.' : !turns.current.length ? 'Set these and I will build your plan from them.' : missing.length ? 'I missed the ones marked. Set those, and fix anything I got wrong.' : 'Fix anything I got wrong.'}</Text>
          <Field label="Name" flagged={flagged('name') || !draft.name.trim()}>
            <TextInput value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Your first name" placeholderTextColor={C.text3} autoCapitalize="words" style={{ flex: 1, textAlign: 'right', fontSize: 17, fontWeight: '600', color: C.text, minHeight: 36 }} />
          </Field>
          <Field label="Age" flagged={flagged('age')}><Stepper value={draft.age} step={1} min={MIN_AGE} suffix="yrs" onChange={(v) => set({ age: Math.max(MIN_AGE, Math.round(v)) })} /></Field>
          <Field label="Height" flagged={flagged('height')}><Stepper value={draft.heightCm} step={1} min={120} suffix="cm" onChange={(v) => set({ heightCm: v })} /></Field>
          <Field label="Weight" flagged={flagged('weight')}><Stepper value={draft.weightKg} step={0.5} min={35} suffix="kg" onChange={(v) => set({ weightKg: v })} /></Field>
          <Field label="Calorie maths" flagged={flagged('sex')}><Choice value={draft.sex} options={[{ v: 'male', t: 'Male' }, { v: 'female', t: 'Female' }]} onChange={(sex) => set({ sex })} /></Field>
          <Field label="Goal" flagged={flagged('goal')} stacked><Choice value={draft.goal} options={GOALS} onChange={(goal) => set({ goal, targetWeightKg: goal === 'lose' ? draft.weightKg - 5 : goal === 'gain' ? draft.weightKg + 4 : draft.weightKg })} /></Field>
          {draft.goal !== 'maintain' && <Field label="Target weight"><Stepper value={draft.targetWeightKg} step={0.5} min={35} suffix="kg" onChange={(v) => set({ targetWeightKg: v })} /></Field>}
          <Field label="Your week" flagged={flagged('activity')} stacked><Choice value={draft.activity} options={ACTIVITIES} onChange={(activity) => set({ activity })} /></Field>
          {!!draft.notes && (
            <Card style={{ gap: 6 }}>
              <Text style={[T.caption, { fontWeight: '700', letterSpacing: 1 }]}>WHAT I&apos;LL REMEMBER</Text>
              <Text style={[T.sub, { lineHeight: 20, color: C.text }]}>{draft.notes}</Text>
              <Pressable hitSlop={8} onPress={() => set({ notes: undefined })}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 14 }}>Forget this</Text></Pressable>
            </Card>
          )}
        </ScrollView>
        <Button variant="dark" title={editing ? 'Save' : 'That’s right'} disabled={!draft.name.trim()} onPress={() => {
          tap()
          if (!editing) { setPhase('scan'); return }
          dispatch({ type: 'profile', profile: { ...draft, age: Math.max(MIN_AGE, draft.age) } })
          success()
          router.back()
        }} />
      </View>
    )
  }

  if (phase === 'scan') {
    return (
      <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}><BodyScanStep age={draft.age} /></ScrollView>
        <Button variant="dark" title={returning ? 'Update my plan' : state.bodyScan ? 'Build my plan' : 'Skip and build my plan'} onPress={() => buildPlan(draft)} />
      </View>
    )
  }

  // plan
  const targets = computeTargets(draft)
  const training = routine ? WEEKDAYS.filter((d) => routine.days[d].items.length) : []
  return (
    <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        <View style={{ alignItems: 'center' }}><SkyOrb size={150} mode={routine ? 'idle' : 'thinking'} /></View>
        {!routine ? (
          <Text style={[T.title2, { textAlign: 'center' }]}>{returning ? 'Updating' : 'Building'} your plan{draft.name ? `, ${draft.name}` : ''}</Text>
        ) : (
          <>
            <Text style={[T.title1, { textAlign: 'center' }]}>Your plan is ready</Text>
            {!!planNote && <Text style={[T.body, { color: C.text2, textAlign: 'center', lineHeight: 22 }]}>{planNote}</Text>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([[`${training.length}`, 'training days'], [`${targets.kcal}`, 'kcal a day'], [`${targets.protein} g`, 'protein']] as const).map(([big, small]) => (
                <Card key={small} tight style={{ flex: 1, alignItems: 'center' }}><Text style={[T.title2, T.num]}>{big}</Text><Text style={T.caption}>{small}</Text></Card>
              ))}
            </View>
            <Card tight style={{ gap: 6 }}>
              {training.map((d) => (
                <View key={d} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={[T.caption, { width: 34, fontWeight: '700', color: C.text, textTransform: 'capitalize' }]}>{d}</Text>
                  <Text style={[T.sub, { flex: 1, color: C.text }]} numberOfLines={1}>{routine.days[d].title}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
      <Button variant="dark" title="Let&apos;s go" disabled={!routine} onPress={finish} />
    </View>
  )
}

function Field({ label, flagged, stacked, children }: { label: string; flagged?: boolean; stacked?: boolean; children: React.ReactNode }) {
  return (
    <Card tight style={[{ gap: 10 }, !stacked && { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, flagged && { borderWidth: 1.5, borderColor: C.orange }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={T.headline}>{label}</Text>
        {flagged && <Text style={[T.caption, { color: C.orange, fontWeight: '700' }]}>Not heard</Text>}
      </View>
      {children}
    </Card>
  )
}

function Choice<V extends string>({ value, options, onChange }: { value: V; options: { v: V; t: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o.v} accessibilityRole="radio" accessibilityState={{ selected: value === o.v }} onPress={() => { tap(); onChange(o.v) }}
          style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 18, backgroundColor: value === o.v ? C.night : C.fill }}>
          <Text style={{ color: value === o.v ? C.cloud : C.text2, fontWeight: '700', fontSize: 14 }}>{o.t}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const ORB_MODE: Record<Mode, OrbMode> = { thinking: 'thinking', speaking: 'speaking', listening: 'listening', waiting: 'idle' }
