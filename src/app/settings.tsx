import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useStore } from '../lib/store'
import { prettyDate } from '../lib/date'
import { sendTestReminder, syncReminders } from '../lib/notify'
import { memoryOf } from '../lib/memory'
import { remindersOf } from '../lib/reminders'
import { ReminderCard } from '../components/chat/ReminderCard'
import { C, T } from '../theme'
import { signOut, useSession } from '../lib/auth'
import { SkyOrb } from '../components/SkyOrb'
import { PLUS, isPlus, sharesData } from '../lib/plan'
import { VoicePicker } from '../components/VoicePicker'
import { Button, Card, Icon, IconTile, List, Row, SectionHeader, SheetHeader } from '../components/ui'

const chevron = <Icon name="chevron-forward" size={16} color={C.text3} />

/** Everything the user can change: their plan, home gym, privacy choices and the data kept on this phone. */
export default function Settings() {
  const { state, dispatch } = useStore()
  const p = state.profile
  const [erasing, setErasing] = useState(false)
  const { session } = useSession()
  const [tested, setTested] = useState(false)
  const reminders = remindersOf(state)
  const remembered = memoryOf(state).length
  // changes made here reach the phone straight away, not only when the chat is next shown
  useEffect(() => { syncReminders(state) }, [state])
  const goal = p.goal === 'lose' ? 'Lose weight' : p.goal === 'gain' ? 'Build muscle' : 'Maintain'

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Settings" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card onPress={() => router.push('/welcome')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.night, marginTop: 4 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={22} color={C.skyLight} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[T.headline, { color: C.cloud, fontSize: 17 }]}>Talk it through with Breeze</Text>
            <Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 13.5, lineHeight: 18 }}>Changed goal, new schedule, something hurting, meals not working: say it and your plan is updated.</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={C.skyLight} />
        </Card>

        <List style={{ marginTop: 12 }}>
          <Row first left={<IconTile icon="bookmark-outline" />} title="What Breeze remembers" subtitle={remembered ? `${remembered} note${remembered === 1 ? '' : 's'} from your conversations` : 'Nothing yet'} onPress={() => router.push('/memory')} right={chevron} />
          <Row left={<IconTile icon="body" />} title="Your details" subtitle={`${p.age} yrs · ${p.heightCm} cm · ${p.weightKg} kg · ${goal}`} onPress={() => router.push({ pathname: '/welcome', params: { edit: '1' } })} right={chevron} />
          <Row left={<IconTile icon="trophy-outline" />} title="Progress and targets" subtitle={`${state.targets.kcal} kcal · ${state.targets.protein} g protein a day`} onPress={() => router.push('/profile')} right={chevron} />
        </List>

        <SectionHeader title="Home gym" />
        <List>
          <Row first left={<IconTile icon="barbell-outline" />} title={p.gym ?? 'Find your gym'} subtitle={p.gym ? 'Tap to change' : 'Search by name, chain or town, or find gyms near you'} onPress={() => router.push('/gym')} right={chevron} />
        </List>

        <SectionHeader title="Reminders" />
        <View style={{ gap: 10 }}>
          <ReminderCard suggested={reminders.times} />
          {reminders.on && (
            <Card style={{ gap: 10 }}>
              <Text style={[T.caption, { lineHeight: 17 }]}>Each reminder names that day&apos;s meal or workout. {reminders.alarm !== false ? 'It rings and buzzes like an alarm.' : 'It arrives quietly.'} {reminders.repeat ? 'It repeats twice, ten minutes apart, until you open Breeze.' : 'It is sent once.'} Rest days and finished workouts are skipped.</Text>
              <Button small variant="tinted" icon="alert-circle-outline" title={reminders.alarm !== false ? 'Ringing like an alarm. Make them quiet' : 'Quiet. Ring like an alarm'} onPress={() => dispatch({ type: 'reminders', reminders: { ...reminders, alarm: reminders.alarm === false } })} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small variant="tinted" title={reminders.repeat ? 'Send once only' : 'Repeat until opened'} style={{ flex: 1 }} onPress={() => dispatch({ type: 'reminders', reminders: { ...reminders, repeat: !reminders.repeat } })} />
                <Button small variant="ghost" title="Turn off" style={{ flex: 1 }} onPress={() => dispatch({ type: 'reminders', reminders: { ...reminders, on: false } })} />
              </View>
              <Button small variant="ghost" icon="sparkles-outline" title={tested ? 'Sent. It arrives in 5 seconds.' : 'Send a test reminder'} onPress={() => { sendTestReminder(reminders.alarm !== false).then(setTested) }} />
            </Card>
          )}
        </View>

        <SectionHeader title="Breeze’s voice" />
        <VoicePicker />

        <SectionHeader title="Privacy and safety" />
        <List>
          <Row first left={<IconTile icon="videocam-outline" />} title="Camera form check"
            subtitle={p.formConsentAt ? 'Allowed · processed on this phone, never recorded' : 'Not allowed'}
            right={p.formConsentAt ? <Button small variant="ghost" title="Withdraw" onPress={() => dispatch({ type: 'profile', profile: { ...p, formConsentAt: undefined } })} /> : undefined} />
          <Row left={<IconTile icon="body" />} title="Body scan description"
            subtitle={state.bodyScan ? `From ${prettyDate(state.bodyScan.at.slice(0, 10))} · the photo was not kept` : 'None saved'}
            right={state.bodyScan ? <Button small variant="ghost" title="Delete" onPress={() => dispatch({ type: 'bodyScan' })} /> : undefined} />
          <Row left={<IconTile icon="ban-outline" />} title="Blocked people" subtitle={`${state.blocked.length} blocked`} />
        </List>

        <SectionHeader title="Your plan" />
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SkyOrb size={40} />
            <View style={{ flex: 1 }}>
              <Text style={T.headline}>{isPlus(state) ? PLUS.name : 'Breeze Free'}</Text>
              <Text style={T.caption}>{isPlus(state) ? 'Voice coach, harder push, private data' : sharesData(state) ? 'Text coach · you are sharing your data' : 'Text coach · you are not sharing your data'}</Text>
            </View>
          </View>
          <Button small variant={isPlus(state) ? 'ghost' : 'dark'} title={isPlus(state) ? 'Manage plan' : `See ${PLUS.name}`} onPress={() => router.push('/subscribe')} />
          {!isPlus(state) && (
            <Button small variant="ghost" title={sharesData(state) ? 'Stop sharing my data' : 'Data sharing is off. Change'} onPress={() => (sharesData(state) ? dispatch({ type: 'dataChoice', share: false }) : router.push('/subscribe'))} />
          )}
        </Card>

        <SectionHeader title="Account" />
        <Card style={{ gap: 8 }}>
          <Text style={T.headline}>{session ? 'Signed in' : 'Not signed in'}</Text>
          <Text style={[T.sub, { lineHeight: 19 }]}>{session ? `${session.user.email ?? 'Your Google account'}. Your diary, workouts and plan are still kept on this phone.` : 'Your diary, workouts and plan stay on this phone.'}</Text>
          {session
            ? <Button small variant="ghost" title="Sign out" onPress={() => signOut()} />
            : <Button small variant="tinted" title="Sign in" onPress={() => router.push('/sign-in')} />}
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
