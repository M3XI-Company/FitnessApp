import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Initial, PersonDetails, ReportSheet } from '../../components/social/BuddyParts'
import { Button, Card, Icon, IconButton, success, tap } from '../../components/ui'
import { exerciseById } from '../../data/exercises'
import { BUDDY_ERROR, blockPerson, getMessages, makeJointPlan, reportPerson, sendMessage, unmatch, type BuddyError, type BuddyMessage, type ReportReason } from '../../lib/buddies'
import { agoLine, jointDay, whereLine, type BuddyPerson, type JointPlan } from '../../lib/buddyRules'
import { uid } from '../../lib/date'
import { ROUTINE_LIMITS, WEEKDAYS, WEEKDAY_LABEL, routineFor } from '../../lib/routine'
import { useStore } from '../../lib/store'
import type { Weekday } from '../../lib/types'
import { C, T } from '../../theme'

/** How often the conversation is checked for something new while it is open. */
const CHECK_MS = 4000

/** The session two partners do together, with a way to put it into the person's own week. */
function JointPlanCard({ plan, partner, onAgain, busy }: { plan: JointPlan; partner: string; onAgain: () => void; busy: boolean }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [note, setNote] = useState('')
  const routine = routineFor(state)
  const add = (day: Weekday) => {
    const days = { ...routine.days, [day]: jointDay(plan, partner) }
    const rest = WEEKDAYS.filter((d) => !days[d].items.length).length
    if (rest < ROUTINE_LIMITS.minRestDays) { setNote('That would leave you no rest day. Pick a day you already train on.'); return }
    dispatch({ type: 'routine', routine: { id: uid(), createdAt: new Date().toISOString(), source: 'coach', days } })
    success(); setPicking(false); setNote(`Added to your ${WEEKDAY_LABEL[day]}. The rest of your week is unchanged.`)
  }
  return (
    <Card style={{ gap: 10 }}>
      <Pressable onPress={() => { tap(); setOpen(!open) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel={`${open ? 'Hide' : 'Show'} the session you do together`}>
        <Icon name="barbell" size={20} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={T.eyebrow}>Your session together</Text>
          <Text style={T.title3}>{plan.title}</Text>
        </View>
        <Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={[T.body, { fontSize: 16, lineHeight: 24 }]}>{plan.why}</Text>
          <Text style={[T.sub, { lineHeight: 19 }]}>{plan.when}</Text>
          {plan.items.map((i, n) => (
            <Pressable key={`${i.exercise_id}-${n}`} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: i.exercise_id } })} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.sep }}>
              <Text style={[T.headline, { width: 22, color: C.text3 }]}>{n + 1}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={T.headline}>{exerciseById(i.exercise_id)?.name ?? i.exercise_id} <Text style={{ color: C.text2, fontWeight: '500' }}>{i.sets} × {i.reps}</Text></Text>
                <Text style={[T.body, { color: C.text2, lineHeight: 21 }]}>{i.together}</Text>
              </View>
            </Pressable>
          ))}
          {picking ? (
            <View style={{ gap: 8 }}>
              <Text style={T.headline}>Which day?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {WEEKDAYS.map((d) => (
                  <Pressable key={d} onPress={() => { tap(); add(d) }} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: routine.days[d].items.length ? C.fill : C.accentSoft }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>{WEEKDAY_LABEL[d]}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={T.caption}>It replaces what you had on that day. Everything else in your own plan stays as it is.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="ghost" icon="refresh" title={busy ? 'Working…' : 'A different one'} disabled={busy} style={{ flex: 1 }} onPress={onAgain} />
              <Button small title="Add to my week" icon="add" style={{ flex: 1 }} onPress={() => { setNote(''); setPicking(true) }} />
            </View>
          )}
        </>
      )}
      {note ? <Text style={[T.sub, { lineHeight: 19 }]}>{note}</Text> : null}
    </Card>
  )
}

/** The conversation between two matched training partners. */
export default function BuddyChat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [person, setPerson] = useState<BuddyPerson | null>(null)
  const [plan, setPlan] = useState<JointPlan | null>(null)
  const [messages, setMessages] = useState<BuddyMessage[]>([])
  const [loaded, setLoaded] = useState(false)
  const [gone, setGone] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState<BuddyError | null>(null)
  const [panel, setPanel] = useState<'none' | 'about' | 'menu' | 'report'>('none')
  const last = useRef(0)
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)

  const merge = useCallback((more: BuddyMessage[]) => {
    if (!more.length) return
    setMessages((have) => {
      const ids = new Set(have.map((m) => m.id))
      const next = [...have, ...more.filter((m) => !ids.has(m.id))].sort((a, b) => a.id - b.id)
      last.current = next[next.length - 1]?.id ?? 0
      return next
    })
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60)
  }, [])

  const check = useCallback(async () => {
    const r = await getMessages(id, last.current)
    if (!r.ok) { if (r.error === 'not_found') setGone(true); else if (!last.current) setError(r.error); return }
    setError(null); setPerson(r.data.person); if (r.data.plan) setPlan(r.data.plan); setLoaded(true)
    merge(r.data.messages)
  }, [id, merge])

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout>
    // one check after another, so a slow connection never has two running at once
    const loop = async () => { await check(); if (live) timer = setTimeout(loop, CHECK_MS) }
    loop()
    return () => { live = false; clearTimeout(timer) }
  }, [check])

  const send = async () => {
    const say = text.trim()
    if (!say || sending) return
    setSending(true); setError(null)
    const r = await sendMessage(id, say.slice(0, 1000))
    setSending(false)
    if (!r.ok) { if (r.error === 'not_found') setGone(true); else setError(r.error); return }
    setText(''); merge([r.data.message])
  }
  const makePlan = async () => {
    setPlanning(true); setError(null)
    const r = await makeJointPlan(id)
    setPlanning(false)
    if (r.ok) { success(); setPlan(r.data.plan) } else setError(r.error)
  }
  const leave = async (how: 'unmatch' | 'block', reason?: ReportReason) => {
    if (how === 'unmatch') await unmatch(id)
    else if (person) await (reason ? reportPerson(person.id, reason) : blockPerson(person.id))
    router.back()
  }

  const name = person?.name ?? 'Partner'
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: Math.max(20, insets.top + 10), paddingBottom: 10 }}>
        <IconButton icon="chevron-back" size={44} onPress={() => router.back()} label="Back" />
        <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => { tap(); setPanel(panel === 'about' ? 'none' : 'about') }} accessibilityLabel={`About ${name}`}>
          {person && <Initial name={person.name} size={40} />}
          <View style={{ flex: 1 }}>
            <Text style={T.title3} numberOfLines={1}>{name}</Text>
            {person && <Text style={T.caption} numberOfLines={1}>{whereLine(person)}</Text>}
          </View>
        </Pressable>
        <IconButton icon="ellipsis-horizontal" size={44} onPress={() => setPanel(panel === 'menu' ? 'none' : 'menu')} label="Unmatch, block or report" />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, gap: 10, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {gone ? (
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
            <Text style={[T.title3, { textAlign: 'center' }]}>This match has ended</Text>
            <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>One of you left or unmatched, so the conversation is no longer here.</Text>
            <Button small title="Back to partners" onPress={() => router.back()} />
          </Card>
        ) : !loaded ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 10 }}>
            {error ? <Text style={[T.sub, { textAlign: 'center' }]}>{BUDDY_ERROR[error]}</Text> : <ActivityIndicator color={C.sky} />}
          </View>
        ) : (
          <>
            {panel === 'about' && person && <Card><PersonDetails p={person} /></Card>}
            {panel === 'menu' && (
              <Card style={{ gap: 8 }}>
                <Button small variant="ghost" title={`Unmatch ${name}`} onPress={() => leave('unmatch')} />
                <Button small variant="ghost" icon="flag-outline" title="Block or report" onPress={() => setPanel('report')} />
                <Text style={T.caption}>Unmatching or blocking deletes this conversation for both of you. {name} is not told why.</Text>
              </Card>
            )}
            {panel === 'report' && <ReportSheet name={name} onCancel={() => setPanel('none')} onBlock={() => leave('block')} onReport={(r) => leave('block', r)} />}

            {plan ? <JointPlanCard plan={plan} partner={name} onAgain={makePlan} busy={planning} /> : (
              <Card style={{ gap: 10 }}>
                <Text style={T.title3}>Train together</Text>
                <Text style={[T.body, { lineHeight: 22 }]}>Breeze can write one session for the two of you from what each of you is working on. Your own weekly plan stays yours.</Text>
                <Button small icon="sparkles" title={planning ? 'Breeze is writing it…' : 'Write us a session'} disabled={planning} onPress={makePlan} />
              </Card>
            )}

            {!messages.length && <Text style={[T.sub, { textAlign: 'center', marginTop: 16, lineHeight: 19 }]}>You both said yes. Say hello and agree a time at the gym.{'\n'}Meet in public and tell a friend where you will be.</Text>}
            {messages.map((m) => (
              <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '84%', gap: 2 }}>
                <View style={{ backgroundColor: m.mine ? C.night : C.card, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 }}>
                  <Text style={{ fontSize: 17, lineHeight: 25, color: m.mine ? C.cloud : C.text }}>{m.text}</Text>
                </View>
                <Text style={[T.caption, { alignSelf: m.mine ? 'flex-end' : 'flex-start', marginHorizontal: 8 }]}>{agoLine(m.at)}</Text>
              </View>
            ))}
            {loaded && error && <Text style={[T.sub, { color: C.red, textAlign: 'center' }]}>{BUDDY_ERROR[error]}</Text>}
          </>
        )}
      </ScrollView>

      {loaded && !gone && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(12, insets.bottom + 6) }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 24, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center' }}>
            <TextInput value={text} onChangeText={setText} placeholder={`Message ${name}`} placeholderTextColor={C.text3} multiline maxLength={1000} style={{ fontSize: 17, color: C.text, maxHeight: 120, paddingVertical: 10 }} />
          </View>
          <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityLabel="Send" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: sending || !text.trim() ? C.fill2 : C.night, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" size={20} color={C.cloud} />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
