import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { TAG_LABEL, type ComputedRecipe } from '../lib/recipes'
import { fmt } from '../lib/nutrition'
import { C, T } from '../theme'
import { Card, Pill } from './ui'
import { RecipeCover } from './RecipeCover'

/** Recipe list row: cover, per-serving nutrition, and either a fit reason or tags */
export function RecipeRow({ c, reason }: { c: ComputedRecipe; reason?: string }) {
  return (
    <Card tight onPress={() => router.push(`/recipe/${c.recipe.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <RecipeCover c={c} size="thumb" style={{ width: 84 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={T.headline} numberOfLines={2}>{c.recipe.title}</Text>
        <Text style={T.sub}>{fmt.kcal(c.perServing.kcal)} kcal · {fmt.g(c.perServing.protein)} g protein · {c.minutes} min</Text>
        {reason ? <Text style={[T.caption, { color: C.accent }]} numberOfLines={2}>{reason}</Text> : (
          <View style={{ flexDirection: 'row', gap: 6 }}>{c.tags.slice(0, 2).map((t) => <Pill key={t} color={C.text2} bg={C.fill}>{TAG_LABEL[t]}</Pill>)}</View>
        )}
      </View>
    </Card>
  )
}

