import { createElement, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import { daySchedule, mealPlanText, mealsFor, sessionMinutes, type ScheduleItem } from '../../lib/chat'
import { addDays, prettyDate, todayKey, uid } from '../../lib/date'
import { makeEntry } from '../../lib/nutrition'
import { sayTime } from '../../lib/reminders'
import { dayProgress } from '../../lib/routine'
import { useStore } from '../../lib/store'
import { C, G, T, shadow } from '../../theme'
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
const LABEL: Record<ScheduleItem['slot'], string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner', workout: 'Train', rest: 'Recover' }

/**
 * The day as a schedule to follow: each meal and the workout as a tile, in
 * the order they happen, at the time they are due. The one step to do at
 * this moment is marked "Now" (or "Up next" when nothing is due yet), the row
 * opens on it, and a panel underneath spells it out with the buttons for it.
 * A meal whose time went by is marked "Missed" instead of still being asked
 * for hours later. The round button on a tile is its action: start the
 * workout, or tick a meal as eaten (which also logs it).
 */
export function DayCard({ date, onStart, onAsk }: { date: string; onStart: () => void; onAsk: (text: string) => void }) {
  const { state, dispatch } = useStore()
  const [copied, setCopied] = useState(false)
  const row = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const today = todayKey()
  const isToday = date === today
  const workout = dayProgress(state, date)
  const meals = mealsFor(state, date)
  const { items, next } = daySchedule(state, date, today)
  const label = isToday ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : prettyDate(date)
  const steps = items.filter((i) => i.slot !== 'rest')
  const upNext = next >= 0 ? items[next] : null
  const due = upNext?.state === 'now'
  const missed = items.filter((i) => i.state === 'missed')

  // open the row on what is next, and follow along as things are ticked off
  useEffect(() => {
    if (next < 1) return
    const t = setTimeout(() => row.current?.scrollTo({ x: next * (TILE_W + GAP), animated: true }), 250)
    return () => clearTimeout(t)
  }, [next])

  const toggleEaten = (i: ScheduleItem) => {
    const r = i.recipe!
    const ids = state.food.filter((f) => f.date === date && f.dataSource === 'recipe' && f.name === r.recipe.title).map((f) => f.id)
    if (ids.length) { tap(); ids.forEach((id) => dispatch({ type: 'removeFood', id })); return }
    dispatch({ type: 'addFood', entry: makeEntry(r.asFood, { servings: meals.portion }, { id: uid(), date, meal: i.slot, source: 'search', dataSource: 'recipe' }) })
    success()
  }
  const copy = () => Clipboard.setStringAsync(mealPlanText([meals])).then(() => { success(); setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={T.title3}>{label}</Text>
            {isToday && (
              <View accessibilityLabel={`${steps.filter((x) => x.done).length} of ${steps.length} done`} style={{ flexDirection: 'row', gap: 5 }}>
                {steps.map((x, i) => <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: x.done ? C.accent : C.fill2 }} />)}
              </View>
            )}
          </View>
          {isToday && (
            <Text style={T.caption}>{!upNext ? 'All done for today' : due ? `Now: ${LABEL[upNext.slot].toLowerCase()}` : `Up next: ${LABEL[upNext.slot].toLowerCase()} at ${sayTime(upNext.time)}`}</Text>
          )}
        </View>
        <Round icon={copied ? 'checkmark' : 'copy-outline'} label="Copy the meals with ingredients" onPress={copy} />
        <Round icon="refresh" label="Different meals" onPress={() => onAsk(`Suggest different meals for ${label.toLowerCase()}`)} />
      </View>

      <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} snapToInterval={TILE_W + GAP} decelerationRate="fast" keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -14 }} contentContainerStyle={{ gap: GAP, paddingHorizontal: 14 }}>
        {items.map((i, n) => {
          const isNext = n === next
          if (i.slot === 'rest' || i.slot === 'workout') {
            const rest = i.slot === 'rest'
            return (
              <Tile key={i.slot} colors={G.night} dark time={i.time} eyebrow={LABEL[i.slot]} icon="barbell-outline" next={isNext} now={isNext && due} done={!rest && i.done}
                title={workout.day.title}
                big={rest ? 'Rest' : i.done ? 'Done' : `${sessionMinutes(workout.items)} min`}
                small={rest ? 'walk or stretch' : workout.status === 'started' ? `${workout.doneItems} of ${workout.items.length} done` : `${workout.items.length} moves`}
                action={!isToday || rest ? undefined : i.done ? { icon: 'checkmark', on: true, label: 'Workout done' } : { icon: 'play', on: false, label: workout.status === 'started' ? 'Continue workout' : 'Start workout', onPress: onStart }}
                onPress={rest ? undefined : () => onAsk(isToday ? 'Show me today\u2019s workout' : date === addDays(todayKey(), 1) ? 'Show me tomorrow\u2019s workout' : `Show me ${new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}\u2019s workout`)} />
            )
          }
          const r = i.recipe!
          const dark = r.recipe.cover === 'night'
          return (
            <Tile key={`${i.slot}-${r.recipe.id}`} colors={dark ? G.night : r.recipe.cover === 'dawn' ? G.dawn : G.day} dark={dark} time={i.time} eyebrow={LABEL[i.slot]} glyph={r.recipe.title} next={isNext} now={isNext && due} missed={i.state === 'missed'} done={i.done}
              title={r.recipe.title}
              big={`${Math.round(r.perServing.kcal * meals.portion)} kcal`}
              small={`${Math.round(r.perServing.protein * meals.portion)} g protein`}
              action={isToday ? { icon: 'checkmark', on: i.done, label: i.done ? `${r.recipe.title} eaten, tap to undo` : `Mark ${r.recipe.title} as eaten`, onPress: () => toggleEaten(i) } : undefined}
              onPress={() => router.push({ pathname: '/meal/[id]', params: { id: r.recipe.id, date, slot: i.slot } })} />
          )
        })}
      </ScrollView>

      {isToday && upNext && (
        <View style={[{ backgroundColor: '#fff', borderRadius: 22, padding: 14, gap: 10 }, shadow]}>
          <View style={{ gap: 3 }}>
            <Text style={{ color: C.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>{due ? 'DO THIS NOW' : `UP NEXT · ${sayTime(upNext.time).toUpperCase()}`}</Text>
            <Text style={T.headline}>{upNext.recipe ? `${LABEL[upNext.slot]}: ${upNext.recipe.recipe.title}` : `${LABEL[upNext.slot]}: ${workout.day.title}`}</Text>
            <Text style={T.caption}>{upNext.recipe
              ? `${Math.round(upNext.recipe.perServing.kcal * meals.portion)} kcal · ${Math.round(upNext.recipe.perServing.protein * meals.portion)} g protein · about ${upNext.recipe.minutes} min to make`
              : `${workout.items.length} moves · about ${sessionMinutes(workout.items)} min${workout.status === 'started' ? ` · ${workout.doneItems} done` : ''}`}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {upNext.recipe ? (
              <>
                <Button small variant="tinted" icon="book-outline" title="Open recipe" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/meal/[id]', params: { id: upNext.recipe!.recipe.id, date, slot: upNext.slot } })} />
                <Button small variant="dark" icon="checkmark" title="I’ve eaten it" style={{ flex: 1 }} onPress={() => toggleEaten(upNext)} />
              </>
            ) : (
              <>
                <Button small variant="tinted" icon="eye-outline" title="See the workout" style={{ flex: 1 }} onPress={() => onAsk('Show me today’s workout')} />
                <Button small variant="dark" icon="play" title={workout.status === 'started' ? 'Continue' : 'Start workout'} style={{ flex: 1 }} onPress={onStart} />
              </>
            )}
          </View>
          {missed.length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => { tap(); onAsk(`I missed ${missed.map((m) => LABEL[m.slot].toLowerCase()).join(' and ')}. Rebuild the rest of today’s meals around what is left.`) }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sep }, pressed && { opacity: 0.6 }]}>
              <Icon name="refresh" size={16} color={C.accent} />
              <Text style={[T.sub, { flex: 1, color: C.text }]}>{missed.map((m) => LABEL[m.slot]).join(' and ')} {missed.length > 1 ? 'were' : 'was'} missed. <Text style={{ color: C.accent, fontWeight: '700' }}>Rebuild the rest of today</Text></Text>
            </Pressable>
          )}
        </View>
      )}
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

function Tile({ colors, dark, time, eyebrow, icon, glyph, title, big, small, action, next, now, missed, done, onPress }: {
  colors: readonly [string, string, ...string[]]; dark: boolean; time: string; eyebrow: string; icon?: IconName; glyph?: string
  title: string; big: string; small: string
  action?: { icon: IconName; on: boolean; label: string; onPress?: () => void }
  next?: boolean; now?: boolean; missed?: boolean; done?: boolean
  onPress?: () => void
}) {
  const fg = dark ? C.cloud : C.night
  const sub = dark ? C.skyLight : C.night
  const when = time ? sayTime(time) : ''
  return (
    <Pressable accessibilityLabel={`${when ? `${when}, ` : ''}${eyebrow}: ${title}, ${big}, ${small}${now ? ', do this now' : next ? ', up next' : ''}${missed ? ', missed' : ''}${done ? ', done' : ''}`} disabled={!onPress} onPress={() => { tap(); onPress?.() }}
      style={({ pressed }) => [{ opacity: missed ? 0.5 : done && !next ? 0.62 : 1 }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: TILE_W, height: TILE_H, borderRadius: 26, padding: 16, justifyContent: 'space-between', borderWidth: next ? 3 : 0, borderColor: now ? C.dawn : C.sky }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 3 }}>
            {(next || missed) && <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', backgroundColor: missed ? 'rgba(255,255,255,.7)' : now ? C.dawn : C.sky }}><Text style={{ color: C.night, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>{missed ? 'MISSED' : now ? 'NOW' : 'UP NEXT'}</Text></View>}
            <Text style={{ color: sub, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.85 }}>{when ? `${when} · ` : ''}{eyebrow}</Text>
          </View>
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
