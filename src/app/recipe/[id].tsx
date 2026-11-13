import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../../lib/store'
import { fitFor, recipeById, scaledGrams, TAG_LABEL } from '../../lib/recipes'
import { dayTotals, fmt, makeEntry, nutritionFor, remainingOf } from '../../lib/nutrition'
import { defaultMeal, mealLabel, useMeals } from '../../lib/meals'
import { SOURCES } from '../../lib/sources'
import { todayKey, uid } from '../../lib/date'
import { C, T } from '../../theme'
import { Button, Card, Icon, IconButton, Pill, Segmented, Stepper, success, tap } from '../../components/ui'
import { RecipeCover } from '../../components/RecipeCover'
import { RestTimer } from '../../components/RestTimer'

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { state, dispatch } = useStore()
  const meals = useMeals()
  const c = recipeById(id)
  const [cookServings, setCookServings] = useState(c?.recipe.servings ?? 1)
  const [tab, setTab] = useState<'ingredients' | 'method'>('ingredients')
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [timer, setTimer] = useState<{ endsAt: number; total: number; step: number } | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [eaten, setEaten] = useState(1)
  const [meal, setMeal] = useState(defaultMeal())
  if (!c) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={T.title2}>Recipe not found</Text></View>

  const remaining = remainingOf(state.targets, dayTotals(state.food, todayKey()).total)
  const fit = fitFor(c.perServing, remaining)
  const per = c.perServing
  const logged = nutritionFor(c.asFood, { servings: eaten })
  const addToDiary = () => {
    dispatch({ type: 'addFood', entry: makeEntry(c.asFood, { servings: eaten }, { id: uid(), date: todayKey(), meal, source: 'search', dataSource: 'recipe' }) })
    success(); setLogOpen(false); router.navigate('/food')
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <RecipeCover c={c} size="hero" />
          <View style={{ position: 'absolute', top: insets.top + 20, right: 28 }}><IconButton icon="close" onPress={() => router.back()} label="Close" /></View>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={T.title1}>{c.recipe.title}</Text>
          <Text style={[T.body, { color: C.text2, lineHeight: 22 }]}>{c.recipe.description}</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['time-outline', `${c.minutes} min`], ['flame-outline', `${fmt.kcal(per.kcal)} kcal`], ['barbell-outline', `${fmt.g(per.protein)} g protein`]] as const).map(([icon, text]) => (
              <View key={text} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 16, backgroundColor: C.card }}>
                <Icon name={icon} size={20} color={C.accent} /><Text style={T.headline}>{text}</Text>
              </View>
            ))}
          </View>

          <Card style={{ gap: 10 }}>
            <Text style={T.eyebrow}>Per serving</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {([['Calories', fmt.kcal(per.kcal), ''], ['Protein', fmt.g(per.protein), 'g'], ['Carbs', fmt.g(per.carbs), 'g'], ['Fat', fmt.g(per.fat), 'g']] as const).map(([l, v, u]) => (
                <View key={l} style={{ alignItems: 'center' }}><Text style={T.title3}>{v}{u}</Text><Text style={T.caption}>{l}</Text></View>
              ))}
            </View>
            <View style={{ gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.sep }}>
              <Text style={[T.sub, { color: fit.fits ? C.green : C.orange, fontWeight: '700' }]}>{fit.fits ? 'Fits your day' : 'More than you have left today'}</Text>
              {fit.reasons.map((r) => <Text key={r} style={T.sub}>• {r}</Text>)}
            </View>
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {c.tags.map((t) => <Pill key={t} color={C.text2} bg={C.fill}>{TAG_LABEL[t]}</Pill>)}
          </View>
          <Card tight style={{ gap: 4, backgroundColor: c.allergens.length ? '#FFEBDD' : C.card }}>
            <Text style={T.headline}>{c.allergens.length ? `Contains: ${c.allergens.join(', ')}` : 'No major allergens in the ingredients'}</Text>
            <Text style={[T.caption, { lineHeight: 16 }]}>Worked out from the ingredient list. Always check product labels for allergens and “may contain” warnings.</Text>
          </Card>

          <Segmented value={tab} onChange={setTab} options={[{ value: 'ingredients', label: 'Ingredients' }, { value: 'method', label: 'Method' }]} />

          {tab === 'ingredients' ? (
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={T.headline}>Servings</Text>
                <Stepper value={cookServings} step={1} min={1} onChange={setCookServings} />
              </View>
              {scaledGrams(c, cookServings).map((i, idx) => (
                <Pressable key={idx} onPress={() => { tap(); setChecked({ ...checked, [idx]: !checked[idx] }) }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sep }}>
                  <Icon name={checked[idx] ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={checked[idx] ? C.night : C.text3} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }, checked[idx] && { color: C.text3, textDecorationLine: 'line-through' }]}>{i.label}</Text>
                    {i.note ? <Text style={T.caption}>{i.note}</Text> : null}
                  </View>
                  <Text style={[T.sub, T.num]}>{fmt.g0(i.grams)} g</Text>
                </Pressable>
              ))}
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {c.recipe.steps.map((s, i) => (
                <Card key={i} style={{ gap: 8 }}>
                  <Text style={T.title3}>Step {i + 1}</Text>
                  <Text style={[T.body, { lineHeight: 22 }]}>{s.text}</Text>
                  {s.timerMin ? (
                    timer?.step === i
                      ? <RestTimer endsAt={timer.endsAt} total={timer.total} onChange={(endsAt, total) => setTimer({ endsAt, total, step: i })} onDone={() => setTimer(null)} />
                      : <Button small variant="tinted" icon="timer-outline" title={`Start ${s.timerMin}-minute timer`} style={{ alignSelf: 'flex-start' }} onPress={() => setTimer({ endsAt: Date.now() + s.timerMin! * 60000, total: s.timerMin! * 60, step: i })} />
                  ) : null}
                </Card>
              ))}
            </View>
          )}
          <Text style={[T.caption, { lineHeight: 16 }]}>{SOURCES.recipe.attribution} Recipe by Breeze; not yet reviewed by a registered nutritionist.</Text>
        </View>
      </ScrollView>

      {/* sticky Add to diary */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 16 + insets.bottom, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.sep, gap: 12 }}>
        {logOpen && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View><Text style={T.headline}>Servings eaten</Text><Text style={T.caption}>{fmt.kcal(logged.kcal)} kcal · {fmt.g(logged.protein)} g protein</Text></View>
              <Stepper value={eaten} step={0.5} min={0.5} onChange={setEaten} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {meals.map((m) => (
                <Pressable key={m.slot} onPress={() => { tap(); setMeal(m.slot) }} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.night : C.card }}>
                  <Text style={{ fontWeight: '600', color: meal === m.slot ? C.skyLight : C.text2 }}>{m.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        <Button title={logOpen ? `Add to ${mealLabel(meal, meals)}` : 'Add to food diary'} icon="add" onPress={() => (logOpen ? addToDiary() : setLogOpen(true))} />
      </View>
    </View>
  )
}
