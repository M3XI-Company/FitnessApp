import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { exerciseById } from '../../data/exercises'
import { mealPlanText, portionFor, portionLabel } from '../../lib/chat'
import { prettyDate, todayKey } from '../../lib/date'
import { recipeById, type ComputedRecipe } from '../../lib/recipes'
import { WEEKDAYS, WEEKDAY_LABEL } from '../../lib/routine'
import { useStore } from '../../lib/store'
import type { ChatMessage } from '../../lib/types'
import { C, T } from '../../theme'
import { CopyButton } from '../chat/DayCard'
import { Button, Card, Icon, Pill, success } from '../ui'

/** A weekly routine the coach proposes. Nothing changes until the user taps the button. */
export function RoutineCard({ routine }: { routine: NonNullable<ChatMessage['routine']> }) {
  const { state, dispatch } = useStore()
  const inUse = state.routine?.id === routine.id
  const training = WEEKDAYS.filter((d) => routine.days[d].items.length)
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="barbell-outline" color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>Weekly routine</Text><Pill>{`${training.length} days`}</Pill>
      </View>
      {WEEKDAYS.map((d) => {
        const day = routine.days[d]
        return (
          <View key={d} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
            <Text style={[T.caption, { width: 34, fontWeight: '700', color: day.items.length ? C.text : C.text3, marginTop: 2 }]}>{WEEKDAY_LABEL[d]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontWeight: '600', color: day.items.length ? C.text : C.text3 }]}>{day.title}</Text>
              {day.items.length > 0 && <Text style={T.caption}>{day.items.map((i) => `${exerciseById(i.exerciseId)?.name} ${i.sets}×${i.reps}`).join(' · ')}</Text>}
            </View>
          </View>
        )
      })}
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.sep }}>
        {inUse
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 }}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={[T.headline, { color: C.green }]}>This is your routine</Text></View>
          : <Button title="Use this routine" icon="checkmark" onPress={() => { dispatch({ type: 'routine', routine }); success() }} />}
      </View>
    </Card>
  )
}

/** Meals the coach proposes for the coming days. */
export function MealPlanCard({ meals }: { meals: NonNullable<ChatMessage['meals']> }) {
  const { state, dispatch } = useStore()
  const dates = Object.keys(meals).sort()
  const inUse = dates.every((d) => meals[d].every((id) => (state.boxedPlan[d] ?? []).includes(id)))
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="restaurant-outline" color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>Meal plan</Text><Pill>{`${dates.length} days`}</Pill>
      </View>
      {dates.map((d) => {
        const recipes = meals[d].map(recipeById).filter((r) => !!r)
        const portion = portionFor(state.targets, recipes)
        const kcal = recipes.reduce((a, r) => a + r.perServing.kcal, 0) * portion
        const protein = recipes.reduce((a, r) => a + r.perServing.protein, 0) * portion
        return (
          <View key={d} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[T.body, { fontWeight: '600' }]}>{prettyDate(d)}</Text>
              <Text style={[T.caption, T.num]}>{Math.round(kcal)} kcal · {Math.round(protein)} g protein</Text>
            </View>
            <Text style={T.caption}>{recipes.map((r) => r.recipe.title).join(' · ')}{portion === 1 ? '' : ` · ${portionLabel(portion)} of each`}</Text>
          </View>
        )
      })}
      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.sep }}>
        {inUse
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 6 }}><Icon name="checkmark-circle" size={18} color={C.green} /><Text style={[T.headline, { color: C.green }]}>This is your meal plan</Text></View>
          : <Button title="Use this meal plan" icon="checkmark" onPress={() => { dispatch({ type: 'mealPlan', days: meals }); success() }} />}
        <View style={{ flexDirection: 'row' }}>
          <CopyButton label="Copy plan with ingredients" text={() => mealPlanText(dates.map((d) => { const recipes = meals[d].map(recipeById).filter((r): r is ComputedRecipe => !!r); return { date: d, recipes, portion: portionFor(state.targets, recipes) } }))} />
        </View>
      </View>
    </Card>
  )
}

/** A one-off workout from the built-in coach: a checklist that ticks itself as sets are logged today. */
export function WorkoutCard({ workout }: { workout: NonNullable<ChatMessage['workout']> }) {
  const { state } = useStore()
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="barbell" color={C.accent} /><Text style={[T.headline, { flex: 1 }]}>{workout.title}</Text><Pill>{`${workout.items.length} exercises`}</Pill>
      </View>
      {workout.items.map((it) => {
        const doneSets = state.sets.filter((x) => x.exerciseId === it.exerciseId && x.date === todayKey()).length
        const done = doneSets >= it.sets
        const name = exerciseById(it.exerciseId)?.name
        return (
          <Pressable key={it.exerciseId} accessibilityLabel={`${name}, ${done ? 'done' : `${doneSets} of ${it.sets} sets done`}`} onPress={() => router.push(`/exercise/${it.exerciseId}`)}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { backgroundColor: C.fill }]}>
            <Icon name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? C.accent : C.text3} />
            <View style={{ flex: 1 }}>
              <Text style={[T.body, { fontWeight: '600', color: done ? C.text3 : C.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{name}</Text>
              <Text style={T.caption}>{it.sets} sets × {it.reps}{doneSets ? ` · ${Math.min(doneSets, it.sets)} of ${it.sets} done` : ''}</Text>
            </View>
            <Icon name="chevron-forward" size={16} color={C.text3} />
          </Pressable>
        )
      })}
    </Card>
  )
}
