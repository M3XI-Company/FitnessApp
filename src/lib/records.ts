/**
 * Keeps the record of workouts in the app's own database (the `records`
 * function and its workout_sets table), so it is not only on the phone.
 * Each set is sent once, shortly after it is logged; a deleted set is
 * removed there too. Someone who is signed in can get their sets back on a
 * new phone. If the send fails it is tried again the next time sets change
 * or the app opens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { deviceId } from './foodPhoto'
import { afterSend, recordChanges } from './recordChanges'
import { supabase } from './supabase'
import type { SetLog } from './types'

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const SENT_KEY = 'breeze.records.sent'

async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!URL_BASE || !ANON) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    // signed in: the account's own token, so the sets are kept against the account as well as the phone
    const token = (await supabase?.auth.getSession())?.data.session?.access_token ?? ANON
    const res = await fetch(`${URL_BASE}/functions/v1/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device: await deviceId(), ...body }),
      signal: ctrl.signal,
    })
    return res.ok ? ((await res.json()) as Record<string, unknown>) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

let busy = false
/** Send whatever the database does not have yet. Safe to call often. */
export async function syncSets(sets: SetLog[]): Promise<void> {
  if (busy || !URL_BASE || !ANON) return
  busy = true
  try {
    let sent: string[] = []
    try { sent = JSON.parse((await AsyncStorage.getItem(SENT_KEY)) ?? '[]') as string[] } catch { sent = [] }
    const change = recordChanges(sets, sent)
    if (!change.add.length && !change.remove.length) return
    const ok = await post({ action: 'sync', add: change.add.map((s) => ({ id: s.id, date: s.date, exerciseId: s.exerciseId, weight: s.weight, reps: s.reps })), remove: change.remove })
    if (ok) await AsyncStorage.setItem(SENT_KEY, JSON.stringify(afterSend(sent, change)))
  } finally {
    busy = false
  }
}

/** The sets the database holds for this phone and, when signed in, this account. Null when it could not be asked. */
export async function pullSets(): Promise<SetLog[] | null> {
  const res = await post({ action: 'pull' })
  const list = res?.sets
  if (!Array.isArray(list)) return null
  const sets = (list as SetLog[]).filter((s) => s && typeof s.id === 'string' && typeof s.date === 'string' && typeof s.exerciseId === 'string' && typeof s.weight === 'number' && typeof s.reps === 'number')
  // what came from the database is already there, so it is not sent back
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify(sets.map((s) => s.id)))
  return sets
}
