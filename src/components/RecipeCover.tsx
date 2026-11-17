import { createElement } from 'react'
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { ComputedRecipe } from '../lib/recipes'
import { TAG_LABEL } from '../lib/recipes'
import { photoFor } from './Photo'
import { C, G } from '../theme'
import { foodIconFor } from './foodIcons'

const FoodGlyph = ({ name, size, color }: { name: string; size: number; color: string }) => createElement(foodIconFor(name), { size, color, strokeWidth: 1.5 })

/**
 * The cover of a recipe: a real photo of the dish, with its name over the
 * bottom of the larger sizes. Falls back to a typographic cover in the Breeze
 * style when there is no photo of it.
 */
export function RecipeCover({ c, size = 'card', style }: { c: ComputedRecipe; size?: 'thumb' | 'card' | 'hero'; style?: StyleProp<ViewStyle> }) {
  const photo = photoFor(c.recipe.id)
  const dark = c.recipe.cover === 'night'
  const colors = dark ? G.night : c.recipe.cover === 'dawn' ? G.dawn : G.day
  const fg = dark ? C.cloud : C.night
  const sub = dark ? C.skyLight : C.night
  const h = size === 'thumb' ? 84 : size === 'card' ? 170 : 230
  const title = size === 'thumb' ? 0 : size === 'card' ? 30 : 40
  const tag = c.tags.find((t) => t !== 'vegetarian' && t !== 'quick') ?? c.tags[0]
  if (photo) {
    return (
      <View style={[{ height: h, borderRadius: size === 'thumb' ? 18 : 22, overflow: 'hidden', backgroundColor: C.fill2, justifyContent: 'flex-end' }, style, { padding: 0 }]}>
        <Image source={photo} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
        {size !== 'thumb' && (
          <LinearGradient colors={['rgba(15,36,64,0)', 'rgba(15,36,64,0.78)']} style={{ padding: 18, paddingTop: 44 }}>
            <Text style={{ fontWeight: '800', letterSpacing: -0.4, fontSize: title * 0.72, lineHeight: title * 0.86, color: '#fff' }} numberOfLines={2}>{c.recipe.title}</Text>
          </LinearGradient>
        )}
      </View>
    )
  }
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
            <Text style={{ fontWeight: '800', letterSpacing: -0.4, fontSize: title * 0.72, lineHeight: title * 0.86, color: fg }} numberOfLines={2}>{c.recipe.title}</Text>
          </View>
        </>
      )}
    </LinearGradient>
  )
}
