import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { exerciseById, worksFor, type MuscleSlug } from '../../data/exercises'
import { WEEKDAYS } from '../../lib/routine'
import type { RoutineDay, WeeklyRoutine, Weekday } from '../../lib/types'
import { C, T } from '../../theme'
import { MuscleMap } from '../MuscleMap'
import { Icon } from '../ui'

export const WEEKDAY_NAME: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }

/** The muscles a day's exercises work, most-used first. */
export function dayMuscles(day: RoutineDay): { primary: MuscleSlug[]; secondary: MuscleSlug[] } {
  const count = new Map<MuscleSlug, number>()
  const helping = new Set<MuscleSlug>()
  for (const item of day.items) {
    const w = worksFor(item.exerciseId)
    for (const m of w.primary) count.set(m, (count.get(m) ?? 0) + 1)
    for (const m of w.secondary) helping.add(m)
  }
  const primary = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m)
  return { primary, secondary: [...helping].filter((m) => !count.has(m)) }
}

/** The picture beside a day: a figure with the muscles that day works lit up, or a rest mark. */
export function DayThumb({ day, sex, size = 84 }: { day: RoutineDay; sex?: string; size?: number }) {
  const { primary, secondary } = dayMuscles(day)
  return (
    <View style={{ width: size, height: size * 1.12, borderRadius: 16, backgroundColor: day.items.length ? '#fff' : C.fill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {day.items.length
        ? <MuscleMap primary={primary} secondary={secondary} gender={sex === 'female' ? 'female' : 'male'} scale={size / 420} sides="auto" legend={false} />
        : <Icon name="moon" size={size * 0.34} color={C.text3} />}
    </View>
  )
}

/**
 * A week of training set out to be read: each day with a picture of what it
 * works, its name, and the exercises as a short list. Tapping an exercise
 * opens it.
 */
export function RoutineDays({ routine, sex, only }: { routine: WeeklyRoutine; sex?: string; only?: Weekday[] }) {
  const days = only ?? WEEKDAYS
  return (
    <View>
      {days.map((d, n) => {
        const day = routine.days[d]
        const rest = !day.items.length
        return (
          <View key={d} style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: n ? 1 : 0, borderTopColor: C.sep }}>
            <DayThumb day={day} sex={sex} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[T.headline, { fontSize: 17, color: rest ? C.text2 : C.text }]}>{WEEKDAY_NAME[d]} – {rest ? 'Rest' : day.title}</Text>
              {rest ? (
                <Text style={[T.body, { color: C.text2, lineHeight: 22 }]}>{day.focus || 'A walk or some gentle stretching.'}</Text>
              ) : day.items.map((i, k) => (
                <Pressable key={`${i.exerciseId}-${k}`} onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: i.exerciseId } })} hitSlop={4} style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel={`${exerciseById(i.exerciseId)?.name}, ${i.sets} sets of ${i.reps}`}>
                  <Text style={[T.body, { fontSize: 16, lineHeight: 23, color: C.text3 }]}>•</Text>
                  <Text style={[T.body, { flex: 1, fontSize: 16, lineHeight: 23 }]}>{exerciseById(i.exerciseId)?.name ?? i.exerciseId} <Text style={{ color: C.text2 }}>– {i.sets} × {i.reps}</Text></Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      })}
    </View>
  )
}
