import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../lib/store'
import { isAdult } from '../lib/age'
import { prettyDate } from '../lib/date'
import { C, T } from '../theme'
import { Button, Card, Field, Icon, IconTile, List, Row, SectionHeader, SheetHeader, success } from '../components/ui'

const chevron = <Icon name="chevron-forward" size={16} color={C.text3} />

/** Everything the user can change: their plan, home gym, privacy choices and the data kept on this phone. */
export default function Settings() {
  const { state, dispatch } = useStore()
  const p = state.profile
  const [gym, setGym] = useState(p.gym ?? '')
  const [erasing, setErasing] = useState(false)
  const gymChanged = gym.trim() !== (p.gym ?? '')
  const goal = p.goal === 'lose' ? 'Lose weight' : p.goal === 'gain' ? 'Build muscle' : 'Maintain'

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Settings" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Your plan" />
        <List>
          <Row first left={<IconTile icon="body" />} title="Details and goal" subtitle={`${p.age} yrs · ${p.heightCm} cm · ${p.weightKg} kg · ${goal}`} onPress={() => router.push('/onboarding')} right={chevron} />
          <Row left={<IconTile icon="barbell-outline" />} title="Workout routine" subtitle="Ask the coach in the chat to change it" onPress={() => router.back()} right={chevron} />
          <Row left={<IconTile icon="restaurant-outline" />} title="Meal plan" subtitle="Recipes planned for the next 7 days" onPress={() => router.push('/plans')} right={chevron} />
          <Row left={<IconTile icon="flame" />} title="Daily targets" subtitle={`${state.targets.kcal} kcal · ${state.targets.protein} g protein`} onPress={() => router.push('/targets')} right={chevron} />
          {isAdult(p.age) && (
            <Row left={<IconTile icon="camera-outline" />} title={state.bodyScan ? 'Re-evaluate my body' : 'Body scan'}
              subtitle={state.bodyScan ? `Last scan ${prettyDate(state.bodyScan.at.slice(0, 10))}` : 'One photo so the coach can see your starting point'}
              onPress={() => router.push({ pathname: '/onboarding', params: { step: 'scan' } })} right={chevron} />
          )}
          <Row left={<IconTile icon="scale-outline" />} title="Log weight" onPress={() => router.push('/weight')} right={chevron} />
          <Row left={<IconTile icon="book-outline" />} title="Food diary" subtitle="What you have logged each day" onPress={() => router.push('/diary')} right={chevron} />
          <Row left={<IconTile icon="trophy-outline" />} title="Progress and goals" subtitle="Level, goals and achievements" onPress={() => router.push('/profile')} right={chevron} />
        </List>

        <SectionHeader title="Home gym" />
        <Card style={{ gap: 10 }}>
          <Field value={gym} onChangeText={setGym} placeholder="Gym name and town" autoCapitalize="words" returnKeyType="done" />
          <Text style={[T.caption, { lineHeight: 17 }]}>Used to find training partners at your gym once accounts launch.</Text>
          {gymChanged && <Button small title="Save gym" onPress={() => { dispatch({ type: 'profile', profile: { ...p, gym: gym.trim() || undefined } }); success() }} />}
        </Card>

        <SectionHeader title="Privacy and safety" />
        <List>
          <Row first left={<IconTile icon="videocam-outline" />} title="Camera form check"
            subtitle={p.formConsentAt ? 'Allowed · processed on this phone, never recorded' : 'Not allowed'}
            right={p.formConsentAt ? <Button small variant="ghost" title="Withdraw" onPress={() => dispatch({ type: 'profile', profile: { ...p, formConsentAt: undefined } })} /> : undefined} />
          <Row left={<IconTile icon="body" />} title="Body scan description"
            subtitle={state.bodyScan ? 'Saved on this phone · the photo was not kept' : 'None saved'}
            right={state.bodyScan ? <Button small variant="ghost" title="Delete" onPress={() => dispatch({ type: 'bodyScan' })} /> : undefined} />
          <Row left={<IconTile icon="ban-outline" />} title="Blocked people" subtitle={`${state.blocked.length} blocked`} />
        </List>

        <SectionHeader title="Account and subscription" />
        <Card style={{ gap: 6 }}>
          <Text style={T.headline}>Stored on this phone</Text>
          <Text style={[T.sub, { lineHeight: 19 }]}>Breeze does not have accounts yet, so there is nothing to sign in to and nothing is charged. Your diary, workouts and plan stay on this phone.</Text>
        </Card>

        <SectionHeader title="Data" />
        <Card style={{ gap: 12 }}>
          {(state.demo || __DEV__) && (
            <Button small variant="tinted" icon={state.demo ? 'trash-outline' : 'sparkles-outline'} title={state.demo ? 'Remove sample history' : 'Load sample history'} onPress={() => dispatch({ type: 'demo', on: !state.demo })} />
          )}
          {erasing ? (
            <>
              <Text style={[T.body, { lineHeight: 21 }]}>This removes your profile, diary, workouts, routine and coach chat from this phone. It cannot be undone.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button small variant="ghost" title="Cancel" onPress={() => setErasing(false)} style={{ flex: 1 }} />
                <Button small variant="dark" icon="trash-outline" title="Erase everything" onPress={() => { dispatch({ type: 'reset' }); router.replace('/') }} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <Button small variant="ghost" icon="trash-outline" title="Erase all data on this phone" onPress={() => setErasing(true)} />
          )}
        </Card>

        <SectionHeader title="About" />
        <List>
          <Row first left={<IconTile icon="document-text-outline" />} title="Data sources and licences" onPress={() => router.push('/licences')} right={chevron} />
        </List>
      </ScrollView>
    </View>
  )
}
