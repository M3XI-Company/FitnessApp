/**
 * Hands the reminder plan (lib/reminders) to the phone as local notifications.
 * Nothing is sent to a server: the phone holds the schedule and fires it even
 * when the app is closed. Not available on the web.
 *
 * A reminder rings like an alarm clock unless the user asks for quiet ones:
 * the app's own alarm tone, a long buzz, and on Android the alarm volume
 * rather than the notification volume, so it is heard with the phone face
 * down on a bench. A phone only lets a notification ring for as long as its
 * sound file (twelve seconds here); the follow-up pings ring again.
 */
import { Platform, Vibration } from 'react-native'
import * as Notifications from 'expo-notifications'
import { AndroidAudioContentType, AndroidAudioUsage, AndroidImportance, AndroidNotificationPriority, AndroidNotificationVisibility } from 'expo-notifications'
import { planKey, planReminders, remindersOf } from './reminders'
import type { AppState } from './types'

const QUIET_CHANNEL = 'reminders'
const ALARM_CHANNEL = 'alarms'
/** The tone shipped with the app (see the expo-notifications entry in app.json). */
const ALARM_SOUND = 'breeze_alarm.wav'
/** Wait, buzz, pause, buzz…: three long buzzes and a longer one, in milliseconds. */
const BUZZ = [0, 700, 300, 700, 300, 700, 300, 1100]
const supported = Platform.OS === 'ios' || Platform.OS === 'android'

// show reminders as a banner even while the app is open
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  })
}

// with the app open the phone does not buzz for a banner on its own, so buzz for an alarm here
if (supported) {
  Notifications.addNotificationReceivedListener((n) => { if (n.request.content.data?.alarm) Vibration.vibrate(BUZZ) })
}

/** Our Android channels, once made; without them the app's default one is used. */
let channels: { quiet: string; alarm: string } | undefined

async function ensureChannel() {
  if (Platform.OS !== 'android' || channels) return
  try {
    // Android only shows the permission prompt once a channel exists
    await Notifications.setNotificationChannelAsync(QUIET_CHANNEL, { name: 'Meal and workout reminders', importance: AndroidImportance.HIGH })
    // how a channel sounds is fixed when it is made, so the alarm has one of its own
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
      name: 'Meal and workout alarms', importance: AndroidImportance.MAX, sound: ALARM_SOUND, enableVibrate: true, vibrationPattern: BUZZ,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      audioAttributes: { usage: AndroidAudioUsage.ALARM, contentType: AndroidAudioContentType.SONIFICATION },
    })
    channels = { quiet: QUIET_CHANNEL, alarm: ALARM_CHANNEL }
  } catch {
    // Expo Go cannot create channels for a project (it rejects the call); its own default channel is used instead
  }
}

/** What makes a notification ring, or not: the same for a real reminder and the test one. */
function ringing(alarm: boolean): { content: Partial<Notifications.NotificationContentInput>; channelId: string | undefined } {
  if (!alarm) return { content: { sound: true }, channelId: channels?.quiet }
  return {
    content: { sound: ALARM_SOUND, vibrate: BUZZ, priority: AndroidNotificationPriority.MAX, interruptionLevel: 'timeSensitive', data: { alarm: true } },
    channelId: channels?.alarm,
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
  const alarm = remindersOf(s).alarm !== false
  const key = `${alarm ? 'alarm' : 'quiet'}|${planKey(plan)}`
  if (key === scheduled) return running
  scheduled = key
  // one sync at a time, so a cancel never lands in the middle of another sync's scheduling
  running = running.then(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync()
      if (!plan.length || !(await canNotify())) return
      const ring = ringing(alarm)
      for (const p of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: p.id,
          content: { title: p.title, body: p.body, ...ring.content },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: ring.channelId },
        })
      }
    } catch {
      // try again on the next sync
      scheduled = null
    }
  })
  return running
}

/** A reminder a few seconds from now, so the user can see and hear what one is like. */
export async function sendTestReminder(alarm = true): Promise<boolean> {
  if (!(await canNotify(true))) return false
  const ring = ringing(alarm)
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Breeze reminders are on', body: alarm ? 'This is how a meal or workout alarm will sound.' : 'This is how a meal or workout reminder will look.', ...ring.content },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: ring.channelId },
  })
  return true
}
