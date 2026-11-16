/**
 * Hands the reminder plan (lib/reminders) to the phone as local notifications.
 * Nothing is sent to a server: the phone holds the schedule and fires it even
 * when the app is closed. Not available on the web.
 */
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { AndroidImportance } from 'expo-notifications'
import { planKey, planReminders } from './reminders'
import type { AppState } from './types'

const CHANNEL = 'reminders'
const supported = Platform.OS === 'ios' || Platform.OS === 'android'

// show reminders as a banner even while the app is open
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  })
}

/** Our Android channel, or undefined to use the app's default one. */
let channelId: string | undefined

async function ensureChannel() {
  if (Platform.OS !== 'android' || channelId) return
  try {
    // Android only shows the permission prompt once a channel exists
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Meal and workout reminders', importance: AndroidImportance.HIGH })
    channelId = CHANNEL
  } catch {
    // Expo Go cannot create channels for a project (it rejects the call); its own default channel is used instead
  }
}

/** Whether the phone will show reminders. Asks the user when `ask` is set and they have not decided yet. */
export async function canNotify(ask = false): Promise<boolean> {
  if (!supported) return false
  try {
    await ensureChannel()
    const now = await Notifications.getPermissionsAsync()
    if (now.granted) return true
    if (!ask || !now.canAskAgain) return false
    return (await Notifications.requestPermissionsAsync()).granted
  } catch {
    return false
  }
}

let scheduled: string | null = null
let running: Promise<void> = Promise.resolve()

/**
 * Make the phone's schedule match the plan. Safe to call often: it does
 * nothing when the plan has not changed since the last call.
 */
export function syncReminders(s: AppState): Promise<void> {
  if (!supported) return Promise.resolve()
  const plan = planReminders(s)
  const key = planKey(plan)
  if (key === scheduled) return running
  scheduled = key
  // one sync at a time, so a cancel never lands in the middle of another sync's scheduling
  running = running.then(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (!plan.length || !(await canNotify())) return
      for (const p of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: { title: p.title, body: p.body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId },
        })
      }
    } catch {
      // try again on the next sync
      scheduled = null
    }
  })
  return running
}

/** A reminder a few seconds from now, so the user can see what one looks like. */
export async function sendTestReminder(): Promise<boolean> {
  if (!(await canNotify(true))) return false
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Breeze reminders are on', body: 'This is how a meal or workout reminder will look.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId },
  })
  return true
}
