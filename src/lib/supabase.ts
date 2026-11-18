/**
 * The app's connection to its own Supabase project, used for signing in. The
 * session is kept on the phone and refreshed only while the app is open.
 * Set up as the Expo guide for Supabase describes.
 */
import 'expo-sqlite/localStorage/install'
import { AppState } from 'react-native'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

/** Null in a build that has not been given a project to talk to. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}
