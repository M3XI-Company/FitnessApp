/**
 * Signing in with Google, through the app's own Supabase project. Google's
 * page opens in the phone's browser and hands back to the app on its own
 * address; nothing about the person is read here beyond what Supabase keeps
 * for the session.
 */
import { useEffect, useState } from 'react'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { readRedirect } from './authUrl'
import { supabase } from './supabase'

WebBrowser.maybeCompleteAuthSession()

export type SignInError = 'not_configured' | 'cancelled' | 'failed'

/** Where Google sends the person back to: this app. It has to be listed under Redirect URLs in the project's sign-in settings. */
export const signInRedirect = () => makeRedirectUri({ path: 'sign-in' })

/** Opens Google's sign-in and, when it comes back, starts the session. */
export async function signInWithGoogle(): Promise<{ ok: true } | { ok: false; error: SignInError; detail?: string }> {
  if (!supabase) return { ok: false, error: 'not_configured' }
  const redirectTo = signInRedirect()
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })
  if (error || !data?.url) return { ok: false, error: 'failed', detail: error?.message }
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  if (res.type !== 'success') return { ok: false, error: 'cancelled' }
  const back = readRedirect(res.url)
  if (!back.ok) return { ok: false, error: back.reason, detail: back.detail }
  const set = await supabase.auth.setSession({ access_token: back.accessToken, refresh_token: back.refreshToken })
  return set.error ? { ok: false, error: 'failed', detail: set.error.message } : { ok: true }
}

export async function signOut() {
  await supabase?.auth.signOut()
}

/** The signed-in session, or null; `ready` is false until the phone has been asked. */
export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  useEffect(() => {
    if (!supabase) return
    let live = true
    supabase.auth.getSession().then(({ data }) => { if (live) { setSession(data.session); setReady(true) } })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => { if (live) setSession(s) })
    return () => { live = false; data.subscription.unsubscribe() }
  }, [])
  return { session, ready }
}
