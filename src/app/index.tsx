import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { Chat } from '../components/chat/Chat'
import { useSession } from '../lib/auth'
import { useStore } from '../lib/store'
import { C } from '../theme'

/** The whole app is one conversation with the coach. */
export default function Home() {
  const { state, ready } = useStore()
  const { session, ready: asked } = useSession()
  if (!ready || !asked) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.sky} /></View>
  // someone new is offered an account first, and can carry on without one
  if (!state.profile.onboarded) return <Redirect href={session ? '/welcome' : '/sign-in?next=welcome'} />
  return <Chat />
}
