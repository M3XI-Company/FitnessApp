import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { canNotify } from '../../lib/notify'
import { REMINDER_SLOTS, SLOT_LABEL, remindersOf, sanitiseTimes, sayTime, shiftTime, type ReminderSlot } from '../../lib/reminders'
import { useStore } from '../../lib/store'
import type { ReminderTimes } from '../../lib/types'
import { C, T } from '../../theme'
import { Button, Card, Icon, success, tap, type IconName } from '../ui'

const ICON: Record<ReminderSlot, IconName> = { breakfast: 'sunrise', lunch: 'sun', dinner: 'moon', workout: 'barbell-outline' }
const STEP = 15

/**
 * Reminder times in the chat. The times start from what the coach suggested
 * (or what is already set) and can be nudged earlier or later; nothing is
 * scheduled until the user turns reminders on, which is also when the phone
 * asks for permission.
 */
export function ReminderCard({ suggested }: { suggested: ReminderTimes }) {
  const { state, dispatch } = useStore()
  const current = remindersOf(state)
  const [times, setTimes] = useState(() => sanitiseTimes(suggested, current.times))
  const [blocked, setBlocked] = useState(false)
  const same = current.on && REMINDER_SLOTS.every((s) => current.times[s] === times[s])

  const turnOn = async () => {
    if (!(await canNotify(true))) { setBlocked(true); return }
    setBlocked(false)
    dispatch({ type: 'reminders', reminders: { ...current, on: true, times } })
    success()
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {REMINDER_SLOTS.map((slot, i) => (
        <View key={slot} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }}>
          <Icon name={ICON[slot]} size={20} color={C.accent} />
          <Text style={[T.headline, { flex: 1 }]}>{SLOT_LABEL[slot]}</Text>
          <Step icon="remove" label={`${SLOT_LABEL[slot]} earlier`} onPress={() => setTimes(sanitiseTimes({ ...times, [slot]: shiftTime(times[slot], -STEP) }, times))} />
          <Text style={[T.headline, T.num, { width: 78, textAlign: 'center' }]}>{sayTime(times[slot])}</Text>
          <Step icon="add" label={`${SLOT_LABEL[slot]} later`} onPress={() => setTimes(sanitiseTimes({ ...times, [slot]: shiftTime(times[slot], STEP) }, times))} />
        </View>
      ))}
      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.sep }}>
        {same
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 }}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={[T.headline, { color: C.green }]}>Reminders are on</Text></View>
          : <Button title={current.on ? 'Use these times' : 'Turn on reminders'} icon="checkmark" onPress={turnOn} />}
        {blocked && <Text style={[T.caption, { textAlign: 'center', lineHeight: 17 }]}>Notifications are switched off for Breeze. Allow them in your phone&apos;s settings, then try again.</Text>}
      </View>
    </Card>
  )
}

function Step({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={6} onPress={() => { tap(); onPress() }} style={({ pressed }) => [{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={16} color={C.accent} />
    </Pressable>
  )
}
