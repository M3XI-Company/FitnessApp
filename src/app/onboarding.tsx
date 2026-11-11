import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useStore } from '../lib/store'
import { computeTargets } from '../lib/nutrition'
import type { Activity, GoalType, Profile } from '../lib/types'
import { C, T, blueGlow, shadow } from '../theme'
import { Bar, Button, Card, FadeIn, Icon, IconButton, Pill, Ring, Stepper, success, tap } from '../components/ui'

const ACTIVITIES: { v: Activity; t: string; d: string }[] = [
  { v: 'sedentary', t: 'Sedentary', d: 'Desk job, little exercise' },
  { v: 'light', t: 'Lightly active', d: '1–3 workouts / week' },
  { v: 'moderate', t: 'Moderately active', d: '3–5 workouts / week' },
  { v: 'active', t: 'Very active', d: '6–7 workouts / week' },
  { v: 'athlete', t: 'Athlete', d: 'Twice a day or physical job' },
]
const GOALS: { v: GoalType; t: string; e: string }[] = [
  { v: 'lose', t: 'Lose weight', e: '📉' },
  { v: 'maintain', t: 'Maintain', e: '⚖️' },
  { v: 'gain', t: 'Build muscle', e: '💪' },
]

function Option({ on, onPress, title, desc, emoji }: { on: boolean; onPress: () => void; title: string; desc?: string; emoji?: string }) {
  return (
    <Pressable onPress={() => { tap(); onPress() }} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, backgroundColor: on ? C.text : '#fff' }, shadow]}>
      {emoji ? <Text style={{ fontSize: 24 }}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[T.headline, { color: on ? '#fff' : C.text }]}>{title}</Text>
        {desc ? <Text style={{ fontSize: 13, color: on ? 'rgba(255,255,255,.65)' : C.text2 }}>{desc}</Text> : null}
      </View>
      {on && <Icon name="checkmark-circle" color="#fff" size={22} />}
    </Pressable>
  )
}

export default function Onboarding() {
  const { state, dispatch } = useStore()
  const insets = useSafeAreaInsets()
  const [p, setP] = useState<Profile>(state.profile)
  const [step, setStep] = useState(0)
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }))
  const targets = computeTargets(p)
  const total = 6

  const finish = () => {
    dispatch({ type: 'profile', profile: { ...p, onboarded: true } })
    success()
    router.replace('/')
  }

  const screens = [
    <View key="0" style={{ alignItems: 'center', paddingTop: 30 }}>
      <LinearGradient colors={['#3B8BFF', '#0047CC']} style={[{ width: 96, height: 96, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, blueGlow]}>
        <Icon name="water" size={52} color="#fff" />
      </LinearGradient>
      <Text style={[T.largeTitle, { marginTop: 24, textAlign: 'center' }]}>Welcome to Tide</Text>
      <Text style={[T.body, { color: C.text2, fontSize: 17, textAlign: 'center', lineHeight: 24, marginTop: 8, maxWidth: 300 }]}>Calories, training, water and an AI coach — in one calm, focused app.</Text>
      <View style={{ gap: 8, width: '100%', marginTop: 24 }}>
        {[['barcode-outline', 'Scan barcodes & products'], ['barbell-outline', 'Track reps and progression'], ['cube-outline', 'Boxed meal & water plans'], ['sparkles-outline', 'AI trainer that knows your data']].map(([i, x]) => (
          <Card key={x} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon name={i as 'water'} color={C.blue} size={22} /><Text style={T.headline}>{x}</Text></Card>
        ))}
      </View>
    </View>,
    <View key="1" style={{ gap: 14 }}>
      <Text style={T.title1}>What should we call you?</Text>
      <TextInput value={p.name} onChangeText={(v) => set({ name: v })} placeholder="Your name" placeholderTextColor={C.text3} style={{ height: 54, borderRadius: 16, backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 17, color: C.text, ...shadow }} />
      <Text style={[T.title3, { marginTop: 14 }]}>Sex</Text>
      <Text style={[T.sub, { marginTop: -8 }]}>Used to calculate your metabolic rate.</Text>
      <Option on={p.sex === 'male'} onPress={() => set({ sex: 'male' })} title="Male" />
      <Option on={p.sex === 'female'} onPress={() => set({ sex: 'female' })} title="Female" />
    </View>,
    <View key="2" style={{ gap: 12 }}>
      <Text style={T.title1}>Your body</Text>
      <Text style={[T.sub, { marginTop: -4 }]}>This lets us build a plan that fits you.</Text>
      {([['Age', 'age', 1, 'yrs'], ['Height', 'heightCm', 1, 'cm'], ['Weight', 'weightKg', 0.5, 'kg']] as const).map(([label, k, st, suf]) => (
        <Card key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={T.headline}>{label}</Text><Stepper value={p[k]} step={st} suffix={suf} onChange={(v) => set({ [k]: v } as Partial<Profile>)} /></Card>
      ))}
    </View>,
    <View key="3" style={{ gap: 10 }}>
      <Text style={[T.title1, { marginBottom: 6 }]}>How active are you?</Text>
      {ACTIVITIES.map((a) => <Option key={a.v} on={p.activity === a.v} onPress={() => set({ activity: a.v })} title={a.t} desc={a.d} />)}
    </View>,
    <View key="4" style={{ gap: 10 }}>
      <Text style={[T.title1, { marginBottom: 6 }]}>{"What's your goal?"}</Text>
      {GOALS.map((g) => <Option key={g.v} on={p.goal === g.v} emoji={g.e} title={g.t} onPress={() => set({ goal: g.v, targetWeightKg: g.v === 'lose' ? p.weightKg - 5 : g.v === 'gain' ? p.weightKg + 4 : p.weightKg })} />)}
      {p.goal !== 'maintain' && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}><Text style={T.headline}>Target weight</Text><Stepper value={p.targetWeightKg} step={0.5} suffix="kg" onChange={(v) => set({ targetWeightKg: v })} /></Card>
      )}
    </View>,
    <View key="5" style={{ alignItems: 'center' }}>
      <Pill>✓ Your plan is ready</Pill>
      <Text style={[T.title1, { marginTop: 12, textAlign: 'center' }]}>Daily recommendation</Text>
      <Text style={[T.sub, { textAlign: 'center' }]}>You can edit this anytime in your profile.</Text>
      <Card style={{ width: '100%', alignItems: 'center', marginTop: 18 }}>
        <Ring value={1} max={1} size={170} stroke={14}>
          <Text style={[{ fontSize: 40, fontWeight: '800', letterSpacing: -1, color: C.text }, T.num]}>{targets.kcal}</Text>
          <Text style={T.caption}>calories / day</Text>
        </Ring>
        <View style={{ flexDirection: 'row', width: '100%', marginTop: 18 }}>
          {([['Protein', targets.protein, C.protein], ['Carbs', targets.carbs, C.carbs], ['Fat', targets.fat, C.fat]] as const).map(([l, v, c]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}><Text style={[T.title3, { color: c }]}>{v}g</Text><Text style={T.caption}>{l}</Text></View>
          ))}
        </View>
      </Card>
      <Card tight style={{ width: '100%', marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 24 }}>💧</Text>
        <View><Text style={T.headline}>{(targets.waterMl / 1000).toFixed(1)} L water</Text><Text style={T.sub}>35 ml per kg of body weight</Text></View>
      </Card>
      {p.goal !== 'maintain' && (
        <Text style={[T.body, { color: C.text2, textAlign: 'center', marginTop: 16 }]}>
          {"At a healthy pace you'll reach "}<Text style={{ fontWeight: '700', color: C.text }}>{p.targetWeightKg} kg</Text> in about{' '}
          <Text style={{ fontWeight: '700', color: C.text }}>{Math.max(1, Math.round(Math.abs(p.weightKg - p.targetWeightKg) / (p.goal === 'lose' ? 0.5 : 0.25)))} weeks</Text>.
        </Text>
      )}
    </View>,
  ]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {step > 0 && <IconButton icon="chevron-back" onPress={() => setStep(step - 1)} label="Back" />}
        {step > 0 && <View style={{ flex: 1 }}><Bar pct={step / (total - 1)} height={4} /></View>}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <FadeIn key={step}>{screens[step]}</FadeIn>
      </ScrollView>
      <Button variant="dark" title={step === 0 ? 'Get started' : step === total - 1 ? "Let's go" : 'Continue'} disabled={step === 1 && !p.name.trim()}
        onPress={() => (step < total - 1 ? setStep(step + 1) : finish())} />
    </View>
  )
}
