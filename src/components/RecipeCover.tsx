import { createElement } from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { ComputedRecipe } from '../lib/recipes'
import { TAG_LABEL } from '../lib/recipes'
import { C, F, G } from '../theme'
import { foodIconFor } from './foodIcons'

const FoodGlyph = ({ name, size, color }: { name: string; size: number; color: string }) => createElement(foodIconFor(name), { size, color, strokeWidth: 1.5 })

/**
 * Typographic recipe cover in the Breeze style — used until licensed food
 * photography is available (swap for <Image> when recipe.photo exists).
 */
export function RecipeCover({ c, size = 'card', style }: { c: ComputedRecipe; size?: 'thumb' | 'card' | 'hero'; style?: StyleProp<ViewStyle> }) {
  const dark = c.recipe.cover === 'night'
  const colors = dark ? G.night : c.recipe.cover === 'dawn' ? G.dawn : G.day
  const fg = dark ? C.cloud : C.night
  const sub = dark ? C.skyLight : C.night
  const h = size === 'thumb' ? 84 : size === 'card' ? 170 : 230
  const title = size === 'thumb' ? 0 : size === 'card' ? 30 : 40
  const tag = c.tags.find((t) => t !== 'vegetarian' && t !== 'quick') ?? c.tags[0]
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ height: h, borderRadius: size === 'thumb' ? 18 : 22, padding: size === 'thumb' ? 10 : 18, justifyContent: 'space-between', overflow: 'hidden' }, style]}>
      {size === 'thumb' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <FoodGlyph name={c.recipe.title} size={38} color={dark ? C.skyLight : C.night} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {tag ? <Text style={{ color: sub, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' }}>{TAG_LABEL[tag]}</Text> : <View />}
            <FoodGlyph name={c.recipe.title} size={size === 'hero' ? 44 : 32} color={dark ? C.skyLight : C.night} />
          </View>
          <View>
            <Text style={{ fontFamily: F.hand, fontSize: title, lineHeight: title * 1.08, color: fg }} numberOfLines={2}>{c.recipe.title}</Text>
            <View style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: dark ? C.sky : C.night, opacity: 0.8, marginTop: 6, transform: [{ rotate: '-2deg' }] }} />
          </View>
        </>
      )}
    </LinearGradient>
  )
}
