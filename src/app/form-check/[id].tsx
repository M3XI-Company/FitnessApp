import { useRef, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCameraPermissions } from 'expo-camera'
import { useStore } from '../../lib/store'
import { exerciseById } from '../../data/exercises'
import { FormSession, cameraAdvice, supportsForm, type Cue, type FormUpdate, type Landmark } from '../../lib/form/engine'
import type { RunnerMessage } from '../../lib/form/runner'
import { nextTarget } from '../../lib/progress'
import { todayKey, uid } from '../../lib/date'
import { C, F, T } from '../../theme'
import { Button, Card, Icon, IconButton, SheetHeader, Stepper, success, tap, type IconName } from '../../components/ui'
import { PoseCamera } from '../../components/form/PoseCamera'

type Stage = 'consent' | 'setup' | 'live' | 'review'

const PROMISES: [IconName, string][] = [
  ['phone-portrait-outline', 'Your camera is analysed on this phone. Video is never recorded, saved or uploaded — only rep counts stay.'],
  ['eye-outline', 'Breeze only gives feedback when it can see your whole body clearly. Otherwise it stays quiet.'],
  ['chatbubble-ellipses-outline', 'Cues are suggestions based on body angles. They can be wrong — dismiss any that don’t apply.'],
  ['alert-circle-outline', 'A camera can’t judge everything (for example, back rounding). It isn’t a coach or medical advice.'],
  ['hand-left-outline', 'Stop straight away if you feel pain, dizziness or anything unusual.'],
]

export default function FormCheck() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { state, dispatch } = useStore()
  const ex = exerciseById(id)
  const [permission, requestPermission] = useCameraPermissions()
  const [stage, setStage] = useState<Stage>(state.profile.formConsentAt ? 'setup' : 'consent')
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [camState, setCamState] = useState<'starting' | 'camera' | 'ready' | 'error'>('starting')
  const [error, setError] = useState<string | null>(null)
  const [update, setUpdate] = useState<FormUpdate | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const session = useRef<FormSession | null>(null)
  const target = ex ? nextTarget(state, ex.id) : null
  const [weight, setWeight] = useState(target?.weight ?? 0)
  const [reps, setReps] = useState(0)

  const onMessage = (m: RunnerMessage) => {
    if (m.type === 'camera') setCamState('camera')
    else if (m.type === 'ready') setCamState('ready')
    else if (m.type === 'error') { setCamState('error'); setError(m.message) }
    else if (m.type === 'pose' && session.current) {
      const lm: Landmark[] | null = m.lm ? m.lm.map(([x, y, visibility]) => ({ x, y, visibility })) : null
      const u = session.current.push(lm, m.t)
      setUpdate(u)
      if (u.cue) setCues((c) => (c.some((x) => x.id === u.cue!.id) ? c : [...c, u.cue!]))
    }
  }

  if (!ex) return <View style={{ flex: 1, backgroundColor: C.bg }}><SheetHeader title="Not found" onClose={() => router.back()} /></View>
  if (!supportsForm(ex.id)) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Form check" onClose={() => router.back()} />
        <Card style={{ margin: 16, gap: 8 }}><Text style={T.title3}>Not available for {ex.name}</Text><Text style={T.sub}>Camera feedback is only offered where a phone camera can track the movement reliably. Use the 3D demo and log your sets manually.</Text></Card>
      </View>
    )
  }

  const start = async () => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      const r = await requestPermission()
      if (!r.granted) { setError('permission_denied'); setCamState('error'); setStage('live'); return }
    }
    session.current = new FormSession(ex.id)
    setUpdate(null); setCues([]); setCamState('starting'); setError(null)
    setStage('live')
  }
  const finish = () => { setReps(update?.reps ?? 0); setStage('review') }
  const save = () => {
    dispatch({ type: 'addSet', set: { id: uid(), date: todayKey(), exerciseId: ex.id, weight, reps } })
    success(); router.back()
  }

  if (stage === 'consent') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Camera form check" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <Text style={[T.sub, { lineHeight: 19 }]}>Breeze can count your reps and suggest form cues for {ex.name.toLowerCase()} using your phone camera. Before you start:</Text>
          <Card style={{ gap: 14 }}>
            {PROMISES.map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', gap: 12 }}><Icon name={icon} size={20} color={C.accent} /><Text style={[T.body, { flex: 1, lineHeight: 21 }]}>{text}</Text></View>
            ))}
          </Card>
          <Button title="I understand — use my camera" icon="camera" onPress={() => { dispatch({ type: 'profile', profile: { ...state.profile, formConsentAt: new Date().toISOString() } }); setStage('setup') }} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} />
          <Text style={[T.caption, { textAlign: 'center' }]}>You can withdraw this any time in Profile.</Text>
        </ScrollView>
      </View>
    )
  }

  if (stage === 'setup') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title={ex.name} onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Card style={{ gap: 12, alignItems: 'center', paddingVertical: 24 }}>
            <Icon name={cameraAdvice(ex.id).startsWith('Face') ? 'person-outline' : 'walk-outline'} size={44} color={C.accent} />
            <Text style={[T.title3, { textAlign: 'center' }]}>Set up your phone</Text>
            <Text style={[T.body, { textAlign: 'center', lineHeight: 21 }]}>{cameraAdvice(ex.id)} Prop the phone at about waist height in a well-lit space with nothing in your way.</Text>
          </Card>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={T.headline}>Camera</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['user', 'environment'] as const).map((f) => (
                <Pressable key={f} onPress={() => { tap(); setFacing(f) }} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: facing === f ? C.night : C.fill }}>
                  <Text style={{ fontWeight: '600', color: facing === f ? C.skyLight : C.text2 }}>{f === 'user' ? 'Front' : 'Back'}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
          <Button title="Start" icon="play" onPress={start} />
        </ScrollView>
      </View>
    )
  }

  if (stage === 'review') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SheetHeader title="Check your set" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          <Text style={[T.sub, { lineHeight: 19 }]}>The count is an estimate — correct it before saving.</Text>
          <Card style={{ gap: 14 }}>
            <View style={st.row}><Text style={T.headline}>Reps</Text><Stepper value={reps} min={0} onChange={setReps} /></View>
            {ex.step > 0 && <View style={st.row}><Text style={T.headline}>Weight</Text><Stepper value={weight} step={ex.step} suffix="kg" onChange={setWeight} /></View>}
          </Card>
          {cues.length > 0 && (
            <Card style={{ gap: 8 }}>
              <Text style={T.headline}>Suggestions from this set</Text>
              {cues.map((c) => <Text key={c.id} style={[T.body, { lineHeight: 21 }]}>• {c.text}</Text>)}
              <Text style={T.caption}>Based on body angles from the camera; may not be accurate for your body or setup.</Text>
            </Card>
          )}
          <Button title="Save set" icon="checkmark" disabled={reps === 0} onPress={save} />
          <Button title="Try again" variant="ghost" icon="refresh" onPress={start} />
        </ScrollView>
      </View>
    )
  }

  // live
  const tracking = update?.status === 'tracking'
  const isHold = update?.holdSeconds !== undefined
  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      {camState !== 'error' && <PoseCamera facing={facing} onMessage={onMessage} />}
      <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={st.top} pointerEvents="box-none">
          <IconButton icon="close" onPress={() => router.back()} label="Close" />
          <View style={[st.pill, { backgroundColor: tracking ? 'rgba(94,140,97,.9)' : 'rgba(15,36,64,.75)' }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tracking ? '#CFE8CF' : C.sky }} />
            <Text style={st.pillText}>{camState === 'starting' ? 'Starting camera…' : camState === 'camera' ? 'Loading tracker…' : tracking ? 'Tracking' : 'Looking for you'}</Text>
          </View>
          <IconButton icon="camera-reverse-outline" onPress={() => setFacing(facing === 'user' ? 'environment' : 'user')} label="Switch camera" />
        </View>

        {camState === 'error' ? (
          <Card style={{ margin: 16, gap: 10 }}>
            <Text style={T.title3}>Camera unavailable</Text>
            <Text style={[T.body, { lineHeight: 21 }]}>{error === 'permission_denied' ? 'Camera access was declined. You can allow it in Settings, or log your sets manually.' : 'The camera or tracker could not start on this device. You can still use the 3D demo and log sets manually.'}</Text>
            <Button title="Back" variant="ghost" onPress={() => router.back()} />
          </Card>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginTop: 10 }} pointerEvents="none">
              <Text style={st.count}>{isHold ? `${update?.holdSeconds ?? 0}s` : update?.reps ?? 0}</Text>
              <Text style={st.countLabel}>{isHold ? 'held with good line' : 'reps'}</Text>
            </View>
            <View style={{ flex: 1 }} pointerEvents="none" />
            {update && update.status === 'low_confidence' && camState === 'ready' && (
              <View style={st.hint} pointerEvents="none"><Icon name="scan-outline" color={C.skyLight} /><Text style={st.hintText}>{update.hint}</Text></View>
            )}
            {update?.cue && (
              <View style={[st.cue, update.cue.severity === 'caution' && { borderColor: C.orange }]}>
                <Icon name={update.cue.severity === 'caution' ? 'alert-circle' : 'bulb-outline'} color={update.cue.severity === 'caution' ? C.orange : C.skyLight} />
                <Text style={st.cueText}>{update.cue.text}</Text>
                <Pressable hitSlop={10} onPress={() => { tap(); session.current?.dismiss(update.cue!.id); setUpdate({ ...update, cue: null }) }} accessibilityLabel="Dismiss cue"><Text style={{ color: C.skyLight, fontWeight: '700' }}>Dismiss</Text></Pressable>
              </View>
            )}
            <View style={st.bottom}>
              {!isHold && <IconButton icon="remove" onPress={() => { session.current?.setReps((update?.reps ?? 0) - 1); setUpdate(update ? { ...update, reps: Math.max(0, update.reps - 1) } : update) }} label="Remove a rep" />}
              <Button title="Finish set" icon="checkmark" onPress={finish} style={{ flex: 1 }} />
              {!isHold && <IconButton icon="add" onPress={() => { session.current?.setReps((update?.reps ?? 0) + 1); setUpdate(update ? { ...update, reps: update.reps + 1 } : update) }} label="Add a rep" />}
            </View>
            <Text style={st.footer}>On-device · nothing recorded · stop if you feel pain</Text>
          </>
        )}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 32, borderRadius: 99 },
  pillText: { color: C.cloud, fontWeight: '700', fontSize: 13 },
  count: { fontFamily: F.hand, fontSize: 96, lineHeight: 100, color: C.cloud, textShadowColor: 'rgba(0,0,0,.5)', textShadowRadius: 12 },
  countLabel: { color: C.skyLight, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12, marginTop: -6 },
  hint: { flexDirection: 'row', gap: 10, alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(15,36,64,.8)' },
  hintText: { color: C.cloud, flex: 1, fontSize: 14, lineHeight: 19 },
  cue: { flexDirection: 'row', gap: 10, alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 18, backgroundColor: 'rgba(15,36,64,.88)', borderWidth: 1.5, borderColor: C.sky },
  cueText: { color: C.cloud, flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  bottom: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 16 },
  footer: { color: 'rgba(247,251,255,.6)', fontSize: 11, textAlign: 'center', marginTop: 8 },
})
