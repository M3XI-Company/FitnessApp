import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useStore } from '../../lib/store'
import { allRecipes, fitFor, TAG_LABEL, TAG_RULE, type RecipeTag } from '../../lib/recipes'
import { dayTotals, fmt, remainingOf } from '../../lib/nutrition'
import { todayKey } from '../../lib/date'
import { C, T } from '../../theme'
import { Card, Chips, Icon, Screen, SearchField, Segmented, tap } from '../../components/ui'
import { RecipeRow } from '../../components/RecipeRow'

type Sort = 'fit' | 'protein' | 'kcal' | 'time'
const FILTERS: (RecipeTag | 'all')[] = ['all', 'high-protein', 'muscle-building', 'weight-management', 'pre-workout', 'post-workout', 'quick', 'budget', 'vegetarian', 'vegan']

export default function Recipes() {
  const [mode, setMode] = useState<'cook' | 'order'>('cook')
  return (
    <Screen title="Recipes">
      <Segmented value={mode} onChange={setMode} options={[{ value: 'cook', label: 'Cook' }, { value: 'order', label: 'Order' }]} style={{ marginBottom: 14 }} />
      {mode === 'cook' ? <Cook /> : <Order />}
    </Screen>
  )
}

function Cook() {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<RecipeTag | 'all'>('all')
  const [sort, setSort] = useState<Sort>('fit')
  const [fitsOnly, setFitsOnly] = useState(false)
  const remaining = remainingOf(state.targets, dayTotals(state.food, todayKey()).total)

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return allRecipes()
      .map((c) => ({ c, fit: fitFor(c.perServing, remaining) }))
      .filter(({ c }) => tag === 'all' || c.tags.includes(tag))
      .filter(({ c }) => words.every((w) => `${c.recipe.title} ${c.recipe.description} ${c.ingredients.map((i) => i.label).join(' ')}`.toLowerCase().includes(w)))
      .filter(({ fit }) => !fitsOnly || fit.fits)
      .sort((a, b) => sort === 'fit' ? b.fit.score - a.fit.score : sort === 'protein' ? b.c.perServing.protein - a.c.perServing.protein : sort === 'kcal' ? a.c.perServing.kcal - b.c.perServing.kcal : a.c.minutes - b.c.minutes)
  }, [q, tag, sort, fitsOnly, remaining.kcal, remaining.protein]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ gap: 12 }}>
      <SearchField value={q} onChangeText={setQ} placeholder="Search recipes or ingredients" />
      <Chips value={tag} onChange={setTag} items={FILTERS.map((t) => ({ value: t, label: t === 'all' ? 'All' : TAG_LABEL[t] }))} />
      {tag !== 'all' && <Text style={[T.caption, { marginLeft: 4, lineHeight: 16 }]}>{TAG_RULE[tag]}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Segmented style={{ flex: 1 }} value={sort} onChange={setSort} options={[{ value: 'fit', label: 'Best fit' }, { value: 'protein', label: 'Protein' }, { value: 'kcal', label: 'Lightest' }, { value: 'time', label: 'Quickest' }]} />
      </View>
      <Pressable onPress={() => { tap(); setFitsOnly(!fitsOnly) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 }} accessibilityRole="checkbox" accessibilityState={{ checked: fitsOnly }}>
        <Icon name={fitsOnly ? 'checkbox' : 'square-outline'} size={20} color={fitsOnly ? C.ink : C.text3} />
        <Text style={T.sub}>Only show what fits my {fmt.kcal(Math.max(0, remaining.kcal))} kcal left today</Text>
      </Pressable>
      <Text style={[T.sub, { marginLeft: 4 }]}>{list.length} recipe{list.length === 1 ? '' : 's'}</Text>
      {list.map(({ c, fit }) => <RecipeRow key={c.recipe.id} c={c} reason={sort === 'fit' ? fit.reasons[0] : undefined} />)}
      {!list.length && <Card><Text style={[T.sub, { textAlign: 'center' }]}>No recipes match. Try another filter.</Text></Card>}
      <Text style={[T.caption, { lineHeight: 16, marginTop: 4 }]}>Nutrition is calculated from UK CoFID values for each ingredient. Recipes by Breeze — not yet reviewed by a registered nutritionist.</Text>
    </View>
  )
}

function Order() {
  return (
    <Card style={{ gap: 10, alignItems: 'center', paddingVertical: 28 }}>
      <Icon name="bag-handle-outline" size={40} color={C.accent} />
      <Text style={[T.title2, { textAlign: 'center' }]}>Ready meals are coming</Text>
      <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>Prepared meals from UK providers, filtered by your remaining calories and protein. We’ll only show meals, prices and nutrition from providers who have agreed to share them.</Text>
    </Card>
  )
}
