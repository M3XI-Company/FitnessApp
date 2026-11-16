import { createElement, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import { mealPlanText, mealsFor, sessionMinutes } from '../../lib/chat'
import { addDays, prettyDate, todayKey, uid } from '../../lib/date'
import { makeEntry } from '../../lib/nutrition'
import type { ComputedRecipe } from '../../lib/recipes'
import { dayProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, G, T } from '../../theme'
import { foodIconFor } from '../foodIcons'
import { Button, Icon, success, tap, type IconName } from '../ui'

/** Copies text and shows "Copied" for a moment. */
export function CopyButton({ text, label = 'Copy' }: { text: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button small variant="tinted" icon={copied ? 'checkmark' : 'copy-outline'} title={copied ? 'Copied' : label} style={{ flex: 1 }}
      onPress={() => { Clipboard.setStringAsync(text()).then(() => { success(); setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {}) }} />
  )
}

const TILE_W = 212
const TILE_H = 196
const GAP = 10
const SLOTS = ['breakfast', 'lunch', 'dinner'] as const

/**
 * A day of the plan as a row of tiles to swipe through: the workout first,
 * then each meal. One headline and one number per tile; everything else is a
 * tap away. The round button on a tile is the action: start the workout, or
 * tick a meal as eaten (which also logs it). It reads the plan live, so
 * today's row always shows what has been done.
 */
export function DayCard({ date, onStart, onAsk }: { date: string; onStart: () => void; onAsk: (text: string) => void }) {
  const { state, dispatch } = useStore()
  const [copied, setCopied] = useState(false)
  const today = todayKey()
  const isToday = date === today
  const workout = dayProgress(state, date)
  const meals = mealsFor(state, date)
  const label = isToday ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : prettyDate(date)
  const slotOf = (i: number) => (meals.recipes.length === 3 ? SLOTS[i] : 'snack')
  const slotLabel = (i: number) => (meals.recipes.length === 3 ? SLOTS[i] : `meal ${i + 1}`)
  const eatenIds = (r: ComputedRecipe) => state.food.filter((f) => f.date === date && f.dataSource === 'recipe' && f.name === r.recipe.title).map((f) => f.id)
  const toggleEaten = (r: ComputedRecipe, i: number) => {
    const ids = eatenIds(r)
    if (ids.length) { tap(); ids.forEach((id) => dispatch({ type: 'removeFood', id })); return }
    dispatch({ type: 'addFood', entry: makeEntry(r.asFood, { servings: meals.portion }, { id: uid(), date, meal: slotOf(i), source: 'search', dataSource: 'recipe' }) })
    success()
  }
  // one dot per thing to do today: the workout (unless it is a rest day) and each meal
  const steps = [...(workout.status === 'rest' ? [] : [workout.status === 'done']), ...meals.recipes.map((r) => eatenIds(r).length > 0)]
  const copy = () => Clipboard.setStringAsync(mealPlanText([meals])).then(() => { success(); setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 }}>
        <Text style={T.title3}>{label}</Text>
        {isToday && (
          <View accessibilityLabel={`${steps.filter(Boolean).length} of ${steps.length} done`} style={{ flexDirection: 'row', gap: 5, flex: 1 }}>
            {steps.map((done, i) => <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: done ? C.accent : C.fill2 }} />)}
          </View>
        )}
        {!isToday && <View style={{ flex: 1 }} />}
        <Round icon={copied ? 'checkmark' : 'copy-outline'} label="Copy the meals with ingredients" onPress={copy} />
        <Round icon="refresh" label="Different meals" onPress={() => onAsk(`Suggest different meals for ${label.toLowerCase()}`)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={TILE_W + GAP} decelerationRate="fast" keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -14 }} contentContainerStyle={{ gap: GAP, paddingHorizontal: 14 }}>
        <Tile colors={G.night} dark eyebrow={workout.status === 'rest' ? 'Recover' : 'Train'} icon="barbell-outline"
          title={workout.day.title}
          big={workout.status === 'rest' ? 'Rest' : workout.status === 'done' ? 'Done' : `${sessionMinutes(workout.items)} min`}
          small={workout.status === 'rest' ? 'walk or stretch' : workout.status === 'started' ? `${workout.doneItems} of ${workout.items.length} done` : `${workout.items.length} moves`}
          action={!isToday || workout.status === 'rest' ? undefined : workout.status === 'done' ? { icon: 'checkmark', on: true, label: 'Workout done' } : { icon: 'play', on: false, label: workout.status === 'started' ? 'Continue workout' : 'Start workout', onPress: onStart }}
          onPress={isToday && (workout.status === 'todo' || workout.status === 'started') ? onStart : undefined} />
        {meals.recipes.map((r, i) => {
          const eaten = eatenIds(r).length > 0
          const dark = r.recipe.cover === 'night'
          return (
            <Tile key={r.recipe.id} colors={dark ? G.night : r.recipe.cover === 'dawn' ? G.dawn : G.day} dark={dark} eyebrow={slotLabel(i)} glyph={r.recipe.title}
              title={r.recipe.title}
              big={`${Math.round(r.perServing.kcal * meals.portion)} kcal`}
              small={`${Math.round(r.perServing.protein * meals.portion)} g protein`}
              action={isToday ? { icon: 'checkmark', on: eaten, label: eaten ? `${r.recipe.title} eaten, tap to undo` : `Mark ${r.recipe.title} as eaten`, onPress: () => toggleEaten(r, i) } : undefined}
              onPress={() => router.push(`/recipe/${r.recipe.id}`)} />
          )
        })}
      </ScrollView>
    </View>
  )
}

function Round({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={6} onPress={() => { tap(); onPress() }} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={17} color={C.accent} />
    </Pressable>
  )
}

function Tile({ colors, dark, eyebrow, icon, glyph, title, big, small, action, onPress }: {
  colors: readonly [string, string, ...string[]]; dark: boolean; eyebrow: string; icon?: IconName; glyph?: string
  title: string; big: string; small: string
  action?: { icon: IconName; on: boolean; label: string; onPress?: () => void }
  onPress?: () => void
}) {
  const fg = dark ? C.cloud : C.night
  const sub = dark ? C.skyLight : C.night
  return (
    <Pressable accessibilityLabel={`${eyebrow}: ${title}, ${big}, ${small}`} disabled={!onPress} onPress={() => { tap(); onPress?.() }} style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: TILE_W, height: TILE_H, borderRadius: 26, padding: 16, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ color: sub, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.85 }}>{eyebrow}</Text>
          {glyph ? createElement(foodIconFor(glyph), { size: 26, color: sub, strokeWidth: 1.6 }) : icon ? <Icon name={icon} size={24} color={sub} /> : null}
        </View>
        <Text style={{ color: fg, fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={[T.num, { color: fg, fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 }]}>{big}</Text>
            <Text style={{ color: sub, fontSize: 12.5, fontWeight: '600', opacity: 0.85 }}>{small}</Text>
          </View>
          {action && (
            <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={8} disabled={!action.onPress} onPress={action.onPress}
              style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: action.on ? C.green : dark ? C.skyLight : 'rgba(255,255,255,.75)' }, pressed && { opacity: 0.7 }]}>
              <Icon name={action.icon} size={22} color={action.on ? '#FFFFFF' : C.night} />
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
}
