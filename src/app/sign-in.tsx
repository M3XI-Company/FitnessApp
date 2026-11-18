import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { signInWithGoogle, useSession, type SignInError } from '../lib/auth'
import { C, T } from '../theme'
import { HoldToSignIn } from '../components/HoldToSignIn'
import { SkyOrb } from '../components/SkyOrb'
import { tap } from '../components/ui'

const WHY: Record<SignInError, string> = {
  not_configured: 'Sign-in isn’t set up in this build yet.',
  cancelled: 'Sign-in was closed before it finished. Hold the button to try again.',
  failed: 'Google sign-in didn’t go through. Hold the button to try again.',
}

/**
 * Signing in or signing up, which are the same thing here: hold the Google
 * mark and the app takes it from there. A new person gets an account, a
 * returning one gets theirs back.
 */
export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<SignInError | null>(null)
  const onward = () => router.replace(next === 'welcome' ? '/welcome' : '/')
  // already signed in, or just signed in: carry on
  useEffect(() => { if (session) router.replace(next === 'welcome' ? '/welcome' : '/') }, [session, next])

  const go = async () => {
    setBusy(true); setProblem(null)
    const res = await signInWithGoogle()
    setBusy(false)
    if (!res.ok) setProblem(res.error)
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 40, paddingBottom: Math.max(24, insets.bottom + 12), paddingHorizontal: 28, alignItems: 'center' }}>
      <SkyOrb size={84} mode={busy ? 'thinking' : 'idle'} />
      <Text style={[T.title2, { marginTop: 18, textAlign: 'center' }]}>Welcome to Breeze</Text>
      <Text style={[T.body, { color: C.text2, textAlign: 'center', marginTop: 6 }]}>One account keeps your training with you, on any phone.</Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <HoldToSignIn busy={busy} onHeld={go} />
        <Text style={[T.headline, { textAlign: 'center' }]}>{busy ? 'Opening Google…' : 'Press and hold to sign in'}</Text>
        <Text style={[T.caption, { textAlign: 'center', maxWidth: 280, minHeight: 34 }]}>{problem ? WHY[problem] : 'New here? The same button makes your account.'}</Text>
      </View>
      <Pressable onPress={() => { tap(); onward() }} accessibilityRole="button" hitSlop={10} style={({ pressed }) => [{ paddingVertical: 10, paddingHorizontal: 16 }, pressed && { opacity: 0.6 }]}>
        <Text style={{ color: C.text2, fontWeight: '600', fontSize: 15 }}>Not now</Text>
      </Pressable>
    </View>
  )
}
