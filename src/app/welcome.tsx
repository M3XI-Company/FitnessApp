import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BodyScanStep } from '../components/onboarding/BodyScanStep'
import { PlanPoster } from '../components/onboarding/PlanPoster'
import { MIN_AGE } from '../lib/age'
import { askCoach } from '../lib/coachApi'
import { uid } from '../lib/date'
import { thinkingLine } from '../lib/chat'
import { plainReply } from '../lib/reply'
import { askInterview, heardTags, interviewConfigured, knownFrom, understand, type HeardProfile, type InterviewError, type InterviewTurn, type ProfileField } from '../lib/interview'
import { addMemories, memoryOf, notesToMemories } from '../lib/memory'
import { computeTargets } from '../lib/nutrition'
import { buildRoutine } from '../lib/routine'
import { useStore } from '../lib/store'
import type { Activity, GoalType, Profile, WeeklyRoutine } from '../lib/types'
import { canListen, listen, listenOver, pause, speak, stopSpeaking, type Listening, type Overhearing } from '../lib/voice'
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
const FIELD_WORDS: Record<ProfileField, string> = { name: 'your first name', age: 'your age', sex: 'whether to use male or female figures for the calorie maths', height: 'your height', weight: 'your weight', goal: 'your main goal', activity: 'how active your week is' }
const listWords = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')
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
  // the microphone left open while Breeze talks, so the person can cut in mid-question
  const over = useRef<Overhearing | null>(null)
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
  // how many times Breeze has had to ask again for something it still needs
  const chased = useRef(0)

  useEffect(() => () => { alive.current = false; ear.current?.cancel(); over.current?.cancel(); stopSpeaking() }, [])
  useEffect(() => { typingRef.current = typing }, [typing])

  const toReview = useCallback((h: HeardProfile | undefined, n: string) => {
    ear.current?.cancel(); ear.current = null
    over.current?.cancel(); over.current = null
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
        overhear(say)
        speaking = speak(say)
      },
    })
    if (!alive.current) return
    setThought('')
    if (!res.ok) { stopSpeaking(); setError(res.error); setMode('waiting'); return }
    const r = res.reply
    turns.current.push({ role: 'coach', text: r.say })
    setLine(r.say); setPartial(''); setHeard(r.profile); setNotes(r.notes)
    if (!speaking) { setMode('speaking'); overhear(r.say); speaking = speak(r.say) }
    await speaking
    if (!alive.current) return
    const o = over.current
    over.current = null
    if (r.done) { o?.cancel(); afterTalk(r.profile, r.notes); return }
    // talked over: Breeze has already stopped, and what was said is the answer
    if (o?.cutIn()) {
      const said = await o.said
      if (!alive.current) return
      if (said) answer(said); else hear()
      return
    }
    if (o) { o.cancel(); await pause(250); if (!alive.current) return }
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

  /** Keep listening while Breeze says `say`: talking over it stops it mid-sentence. */
  function overhear(say: string) {
    over.current?.cancel()
    over.current = typingRef.current ? null : listenOver(say, () => { stopSpeaking(); setLevel(0); setMode('listening') }, setPartial, setLevel)
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

  /**
   * The conversation is over. There is no form to check: it goes straight on
   * to the photo. If something the plan cannot be built without was never
   * said, Breeze asks for it in the conversation; the form is only the last
   * resort, for someone who stopped talking before it was said.
   */
  function afterTalk(h: HeardProfile | undefined, n: string, chase = true) {
    const u = understand({ ...state.profile, name: state.profile.onboarded ? state.profile.name : '' }, h, n)
    if (u.underAge) { toReview(h, n); return }
    if (u.missing.length && chase && chased.current < 2) {
      chased.current += 1
      const say = `Before I build your plan I still need ${listWords(u.missing.map((f) => FIELD_WORDS[f]))}. Can you tell me?`
      turns.current.push({ role: 'coach', text: say })
      setLine(say); setPartial(''); setMode('speaking')
      speak(say).then(() => { if (alive.current) hear() })
      return
    }
    if (u.missing.length) { toReview(h, n); return }
    ear.current?.cancel(); ear.current = null
    over.current?.cancel(); over.current = null
    stopSpeaking()
    setDraft(u.profile); setMissing([]); setPhase('scan')
  }

  const start = () => { tap(); setPhase('talk'); next() }
  const interrupt = () => { stopSpeaking() }

  // ---- the plan ----
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null)
  const [planNote, setPlanNote] = useState('')
  const [planMeals, setPlanMeals] = useState<Record<string, string[]>>()
  const buildPlan = async (p: Profile) => {
    setPhase('plan'); setRoutine(null)
    speak('Give me a moment while I build your plan.')
    // what was said becomes part of what Breeze remembers, now that the user has confirmed it
    const learned = notesToMemories(p.notes)
    if (learned.length) dispatch({ type: 'remember', texts: learned })
    const draftState = { ...state, profile: p, targets: computeTargets(p), chat: [], memory: addMemories(memoryOf(state), learned) }
    const ask = returning
      ? 'We have just talked things through. Update my weekly routine and my meals for the coming week for what has changed, and keep what is working. Start your reply with a short title, then say in a few lines what you changed and why.'
      : 'Build my first weekly routine and a meal plan for the coming week around everything you know about me: what I told you, what I have done before, how much time I have, where I train, and what you saw in my photo if I gave one. Do not ask me anything more. Start your reply with a short title, then say in a few lines what you are prioritising for me and why, so I can see the plan is mine.'
    const res = await askCoach(draftState, [{ id: uid(), role: 'user', text: ask }])
    if (!alive.current) return
    if (res.ok && res.memory.remember.length) dispatch({ type: 'remember', texts: res.memory.remember })
    const made = res.ok && res.message.routine ? res.message.routine : buildRoutine(p)
    if (res.ok && res.message.meals) { dispatch({ type: 'mealPlan', days: res.message.meals }); setPlanMeals(res.message.meals) }
    dispatch({ type: 'routine', routine: made })
    setRoutine(made)
    // the first paragraph is the summary; the rest is detail the chat can give later
    const note = res.ok && res.message.routine ? res.message.text.trim() : 'Here is a starting routine built from your goal and activity level. You can change any of it by asking me.'
    setPlanNote(note)
    // out loud, only the opening: the rest is there to read
    speak(plainReply(note).split('\n').filter(Boolean).slice(0, 2).join('. '))
  }
  const finish = () => {
    stopSpeaking()
    dispatch({ type: 'profile', profile: { ...draft, notes: undefined, age: Math.max(MIN_AGE, draft.age), onboarded: true, healthNoticeAt: draft.healthNoticeAt ?? new Date().toISOString() } })
    dispatch({ type: 'newChat' })
    // the plan is the first thing in the chat, so it is there to come back to
    dispatch({ type: 'chat', messages: [{ id: uid(), role: 'coach', text: planNote || 'Your plan is ready.', routine: routine ?? undefined }] })
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
        <Pressable focusable={false} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34 }} onPress={mode === 'speaking' ? interrupt : undefined} accessibilityLabel={mode === 'speaking' ? 'Breeze is speaking. Talk over it or tap to skip ahead.' : undefined}>
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
        <VoiceBar text={typed} onChangeText={setTyped} onSend={() => { over.current?.cancel(); over.current = null; stopSpeaking(); answer(typed) }} placeholder={hears ? 'Or type your answer' : 'Type your answer'} editable={mode !== 'thinking'}
          mic={!hears ? 'off' : mode === 'listening' ? 'listening' : mode === 'waiting' ? 'ready' : 'busy'}
          onMic={() => { setTyping(false); typingRef.current = false; if (mode === 'listening') ear.current?.stop(); else hear() }}
          onClose={() => afterTalk(heard, notes, false)} closeLabel="Finish the conversation" />
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
          <Text style={[T.sub, { marginTop: -6 }]}>{editing ? 'Keep your age, height and weight up to date and your targets are recalculated. Your goal and your week were set with Breeze.' : !turns.current.length ? 'Set these and I will build your plan from them.' : missing.length ? 'I missed the ones marked. Set those, and fix anything I got wrong.' : 'Fix anything I got wrong.'}</Text>
          <Field label="Name" flagged={flagged('name') || !draft.name.trim()}>
            <TextInput value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Your first name" placeholderTextColor={C.text3} autoCapitalize="words" style={{ flex: 1, textAlign: 'right', fontSize: 17, fontWeight: '600', color: C.text, minHeight: 36 }} />
          </Field>
          <Field label="Age" flagged={flagged('age')}><Stepper value={draft.age} step={1} min={MIN_AGE} suffix="yrs" onChange={(v) => set({ age: Math.max(MIN_AGE, Math.round(v)) })} /></Field>
          <Field label="Height" flagged={flagged('height')}><Stepper value={draft.heightCm} step={1} min={120} suffix="cm" onChange={(v) => set({ heightCm: v })} /></Field>
          <Field label="Weight" flagged={flagged('weight')}><Stepper value={draft.weightKg} step={0.5} min={35} suffix="kg" onChange={(v) => set({ weightKg: v })} /></Field>
          {editing ? (
            // set in the conversation with Breeze, and changed the same way, so a plan is never left built on a goal that was flipped by accident
            <Card style={{ gap: 12 }}>
              <Fixed label="Calorie maths" value={draft.sex === 'female' ? 'Female' : 'Male'} />
              <Fixed label="Goal" value={GOALS.find((g) => g.v === draft.goal)?.t ?? ''} />
              {draft.goal !== 'maintain' && <Fixed label="Target weight" value={`${draft.targetWeightKg} kg`} />}
              <Fixed label="Your week" value={ACTIVITIES.find((a) => a.v === draft.activity)?.t ?? ''} />
              <Text style={[T.caption, { lineHeight: 17 }]}>These were set when you talked to Breeze. To change them, talk it through again and your routine and meals are rebuilt to match.</Text>
              <Button small variant="tinted" icon="sparkles-outline" title="Go through it again with Breeze" onPress={() => router.replace('/welcome')} />
            </Card>
          ) : (
            <>
              <Field label="Calorie maths" flagged={flagged('sex')}><Choice value={draft.sex} options={[{ v: 'male', t: 'Male' }, { v: 'female', t: 'Female' }]} onChange={(sex) => set({ sex })} /></Field>
              <Field label="Goal" flagged={flagged('goal')} stacked><Choice value={draft.goal} options={GOALS} onChange={(goal) => set({ goal, targetWeightKg: goal === 'lose' ? draft.weightKg - 5 : goal === 'gain' ? draft.weightKg + 4 : draft.weightKg })} /></Field>
              {draft.goal !== 'maintain' && <Field label="Target weight"><Stepper value={draft.targetWeightKg} step={0.5} min={35} suffix="kg" onChange={(v) => set({ targetWeightKg: v })} /></Field>}
              <Field label="Your week" flagged={flagged('activity')} stacked><Choice value={draft.activity} options={ACTIVITIES} onChange={(activity) => set({ activity })} /></Field>
            </>
          )}
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
        <Button variant="dark" icon="sparkles" title="Generate my plan" onPress={() => buildPlan(draft)} />
      </View>
    )
  }

  // the finished plan, as a poster to look through before the chat
  if (routine) {
    return (
      <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
        <View style={{ flex: 1 }}><PlanPoster profile={draft} routine={routine} note={planNote} meals={planMeals} /></View>
        <Button variant="dark" title="Start" onPress={finish} />
      </View>
    )
  }

  // the plan is being built
  return (
    <View style={[{ flex: 1, backgroundColor: C.bg }, pad]}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 22 }}>
        <View style={{ alignItems: 'center' }}><SkyOrb size={170} mode="thinking" /></View>
        <Text style={[T.title2, { textAlign: 'center' }]}>{returning ? 'Updating' : 'Building'} your plan{draft.name ? `, ${draft.name}` : ''}</Text>
        <Text style={[T.sub, { textAlign: 'center', lineHeight: 20 }]}>Going through what you told me: your goal, your week, where you train and what you eat.</Text>
      </View>
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

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }} accessibilityLabel={`${label}: ${value}`}>
      <Text style={T.headline}>{label}</Text>
      <Text style={[T.body, { color: C.text2, fontWeight: '600' }]}>{value}</Text>
    </View>
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
