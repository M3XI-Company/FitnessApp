import type { ReactNode } from 'react'
import { Image, type ImageStyle, type StyleProp } from 'react-native'
import { PHOTO_FILES } from '../data/photoFiles'
import { C } from '../theme'

/** The photo for a recipe id or food id, if the app has one. */
export const photoFor = (id: string): number | undefined => PHOTO_FILES[id]

/**
 * A real photo of a meal (by recipe id) or an ingredient (by food id).
 * Shows `children` instead when there is no photo for it, so a screen never
 * has an empty box.
 */
export function Photo({ id, label, style, children }: { id: string; label?: string; style?: StyleProp<ImageStyle>; children?: ReactNode }) {
  const source = photoFor(id)
  if (!source) return <>{children}</>
  return <Image source={source} resizeMode="cover" accessible={!!label} accessibilityLabel={label} style={[{ backgroundColor: C.fill2 }, style]} />
}
