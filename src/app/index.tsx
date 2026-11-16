import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { Chat } from '../components/chat/Chat'
import { useStore } from '../lib/store'
import { C } from '../theme'

/** The whole app is one conversation with the coach. */
export default function Home() {
  const { state, ready } = useStore()
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.sky} /></View>
  if (!state.profile.onboarded) return <Redirect href="/welcome" />
  return <Chat />
}
