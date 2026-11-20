import { useEffect, useRef } from 'react'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { Chat } from '../components/chat/Chat'
import { useSession } from '../lib/auth'
import { pullSets } from '../lib/records'
import { useStore } from '../lib/store'
import { C } from '../theme'

/** The whole app is one conversation with the coach. */
export default function Home() {
  const { state, dispatch, ready } = useStore()
  const { session, ready: asked } = useSession()
  // signed in on a phone with no workouts on it: bring the record back from the database, once
  const pulled = useRef(false)
  const empty = !state.sets.some((x) => !x.demo)
  useEffect(() => {
    if (!ready || !session || !empty || pulled.current) return
    pulled.current = true
    pullSets().then((sets) => { if (sets?.length) dispatch({ type: 'restoreSets', sets }) }).catch(() => {})
  }, [ready, session, empty, dispatch])
  if (!ready || !asked) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.sky} /></View>
  // someone new is offered an account first, and can carry on without one
  if (!state.profile.onboarded) return <Redirect href={session ? '/welcome' : '/sign-in?next=welcome'} />
  return <Chat />
}
