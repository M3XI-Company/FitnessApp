import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { mealPlanText, mealsFor, portionLabel, sessionMinutes } from '../../lib/chat'
import { addDays, prettyDate, todayKey } from '../../lib/date'
import { dayMacros } from '../../lib/progress'
import { dayProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, T } from '../../theme'
import { Button, Card, Icon, success, tap } from '../ui'

/** Copies text and shows "Copied" for a moment. */
export function CopyButton({ text, label = 'Copy' }: { text: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button small variant="tinted" icon={copied ? 'checkmark' : 'copy-outline'} title={copied ? 'Copied' : label} style={{ flex: 1 }}
      onPress={() => { Clipboard.setStringAsync(text()).then(() => { success(); setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {}) }} />
  )
}

/**
 * One day of the plan inside the chat: the workout and the meals. It reads
 * the plan live, so the card for today always shows what has been done.
 */
export function DayCard({ date, onStart, onAsk }: { date: string; onStart: () => void; onAsk: (text: string) => void }) {
  const { state } = useStore()
  const today = todayKey()
  const workout = dayProgress(state, date)
  const meals = mealsFor(state, date)
  const eaten = dayMacros(state, date)
  const label = date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : prettyDate(date)
  const canStart = date === today && (workout.status === 'todo' || workout.status === 'started')
  const workoutLine = workout.status === 'rest' ? 'Recovery. A walk or a stretch is plenty.'
    : workout.status === 'done' ? 'Done'
      : `${workout.status === 'started' ? `${workout.doneItems} of ${workout.items.length} exercises done` : `${workout.items.length} exercises`} · about ${sessionMinutes(workout.items)} min`

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Text style={[T.caption, { fontWeight: '700', letterSpacing: 1, color: C.text3, paddingHorizontal: 14, paddingTop: 12 }]}>{label.toUpperCase()}{label === prettyDate(date) ? '' : ` · ${prettyDate(date).toUpperCase()}`}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={workout.status === 'rest' ? 'moon' : workout.status === 'done' ? 'checkmark' : 'barbell-outline'} size={20} color={C.skyLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={T.headline} numberOfLines={1}>{workout.day.title}</Text>
          <Text style={T.caption}>{workoutLine}</Text>
        </View>
        {canStart && <Button small title={workout.status === 'started' ? 'Continue' : 'Start'} icon="play" onPress={onStart} />}
      </View>

      {meals.recipes.map((r) => (
        <Pressable key={r.recipe.id} accessibilityLabel={`${r.recipe.title}, open recipe`} onPress={() => { tap(); router.push(`/recipe/${r.recipe.id}`) }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
          <View style={{ width: 40, alignItems: 'center' }}><Icon name="restaurant-outline" size={20} color={C.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { fontWeight: '600' }]} numberOfLines={1}>{r.recipe.title}</Text>
            <Text style={[T.caption, T.num]}>{meals.portion === 1 ? '' : `${portionLabel(meals.portion)} · `}{Math.round(r.perServing.kcal * meals.portion)} kcal · {Math.round(r.perServing.protein * meals.portion)} g protein · {r.minutes} min</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={C.text3} />
        </Pressable>
      ))}

      <View style={{ padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
        <Text style={[T.caption, T.num, { lineHeight: 17 }]}>
          Meals: {meals.kcal} of your {state.targets.kcal} kcal, {meals.protein} g protein.{meals.planned ? '' : ' Picked to fit your targets.'}
          {date === today && eaten.kcal > 0 ? ` Logged so far: ${Math.round(eaten.kcal)} kcal.` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CopyButton label="Copy meals" text={() => mealPlanText([meals])} />
          <Button small variant="ghost" icon="refresh" title="Change" style={{ flex: 1 }} onPress={() => onAsk(`Suggest different meals for ${label.toLowerCase()}`)} />
        </View>
      </View>
    </Card>
  )
}
