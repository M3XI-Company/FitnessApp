import { Platform, type TextStyle, type ViewStyle } from 'react-native'

/** Breeze by M3XI — cream, white, black and champagne gold */
export const C = {
  // brand
  accent: '#9A7535', // deep champagne — text, icons, active states (AA on white)
  gold: '#C8A96A', // champagne — rings, fills, highlights
  goldLight: '#E3CB97',
  accentSoft: '#F4ECDC', // tinted tiles
  accentLine: '#E8D9BA',
  ink: '#141210', // black — primary buttons, headings
  cream: '#F5EFE4',
  // surfaces
  bg: '#F5EFE4',
  card: '#FFFFFF',
  fill: '#EFE8DA',
  fill2: '#E7DFCF',
  sep: 'rgba(20,18,16,0.08)',
  // text
  text: '#141210',
  text2: '#6B6358',
  text3: '#A39A8C',
  // status (muted to sit with the palette)
  green: '#5E8C61',
  orange: '#C98A3C',
  red: '#B5483B',
  // macros
  protein: '#141210',
  carbs: '#C8A96A',
  fat: '#9C8B74',
  water: '#B9A27A',
}

/** Gradients */
export const G = {
  ink: ['#2A2520', '#141210'] as const,
  gold: ['#E8D3A4', '#C8A96A', '#A88544'] as const,
}

export const GRADE_COLOR: Record<string, string> = { A: '#4F7D52', B: '#8DA65A', C: '#D2B04C', D: '#C98A3C', E: '#B5483B' }

export const R = { lg: 22, md: 16, sm: 12 }

/** Font families (loaded in app/_layout.tsx) */
export const F = {
  hand: 'Caveat_700Bold',
  handSemi: 'Caveat_600SemiBold',
}

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#3B2F1E', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 1px 2px rgba(59,47,30,.05), 0 8px 24px rgba(59,47,30,.07)' } as ViewStyle,
})!

export const glow: ViewStyle = Platform.select({
  ios: { shadowColor: '#7A5C25', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { boxShadow: '0 14px 34px rgba(122,92,37,.28)' } as ViewStyle,
})!

const t = (fontSize: number, fontWeight: TextStyle['fontWeight'], letterSpacing = 0, color = C.text): TextStyle =>
  ({ fontSize, fontWeight, letterSpacing, color })
/** Handwritten display style — no fontWeight so Android picks the right face */
const h = (fontSize: number, family = F.hand, color = C.text): TextStyle => ({ fontSize, fontFamily: family, color, lineHeight: Math.round(fontSize * 1.15) })

export const T = {
  largeTitle: h(46),
  title1: h(38),
  title2: h(30),
  title3: h(25),
  bigNum: h(64),
  headline: t(16, '600', -0.2),
  body: t(15, '400', -0.1),
  sub: t(13, '500', 0, C.text2),
  caption: t(12, '500', 0, C.text3),
  eyebrow: { ...t(11, '700', 1.4, C.text3), textTransform: 'uppercase' } as TextStyle,
  num: { fontVariant: ['tabular-nums'] } as TextStyle,
}
