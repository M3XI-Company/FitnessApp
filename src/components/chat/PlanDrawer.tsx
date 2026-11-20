import { useMemo } from 'react'
import { PanResponder, Pressable, Text, View } from 'react-native'
import { todayKey } from '../../lib/date'
import { dayProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, T, shadow } from '../../theme'
import { Icon, tap } from '../ui'
import { DayCard } from './DayCard'

/**
 * Today's plan, kept at the top of the chat. Swipe it up (or tap the bar) to
 * put it away and have the whole screen for the conversation; swipe down on
 * the bar to bring it back.
 */
export function PlanDrawer({ open, onChange, onStart, onAsk }: { open: boolean; onChange: (open: boolean) => void; onStart: () => void; onAsk: (text: string) => void }) {
  const { state } = useStore()
  const today = todayKey()
  const day = dayProgress(state, today)
  const pan = useMemo(() => PanResponder.create({
    // only an up-and-down drag: sideways is for the row of meals inside the plan
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderRelease: (_e, g) => {
      if (g.dy < -24 && open) { tap(); onChange(false) }
      else if (g.dy > 24 && !open) { tap(); onChange(true) }
    },
  }), [open, onChange])
  const line = day.status === 'rest' ? 'Rest day' : day.status === 'done' ? `${day.day.title} · done` : `${day.day.title} · ${day.doneItems} of ${day.items.length} done`
  return (
    <View {...pan.panHandlers} style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
      {open && <DayCard date={today} onStart={onStart} onAsk={onAsk} />}
      <Pressable onPress={() => { tap(); onChange(!open) }} accessibilityRole="button" accessibilityLabel={open ? 'Hide today’s plan' : `Show today’s plan. ${line}`}
        style={[{ marginTop: open ? 6 : 0, alignItems: 'center', gap: 4, paddingVertical: open ? 4 : 10, paddingHorizontal: 14, borderRadius: 18 }, !open && { backgroundColor: '#fff', ...shadow }]}>
        {open ? (
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.fill2 }} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
            <Icon name={day.status === 'done' ? 'checkmark-circle' : day.status === 'rest' ? 'moon' : 'barbell-outline'} size={20} color={day.status === 'done' ? C.green : C.accent} />
            <Text style={[T.headline, { flex: 1 }]} numberOfLines={1}>Today · {line}</Text>
            <Text style={[T.caption, { color: C.accent, fontWeight: '700' }]}>Show</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}
