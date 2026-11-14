import { Platform, type TextStyle, type ViewStyle } from 'react-native'

/** Breeze by M3XI — the colours of the sky: cloud white, clear blue, twilight navy and a dawn glow */
export const C = {
  // brand
  accent: '#1F6FB2', // deep sky — text links, icons, active states (AA on white)
  sky: '#5BB3EA', // clear sky — rings, fills, highlights
  skyLight: '#BFE3FA', // pale sky — text/icons on twilight surfaces
  accentSoft: '#E8F4FD', // tinted tiles
  accentLine: '#CDE7F8',
  night: '#0F2440', // twilight navy — dark buttons, headings, dark cards
  cloud: '#F7FBFF',
  dawn: '#FFB38A', // sunrise peach — warm accent
  coral: '#F2765A', // sunrise coral — worked muscles, emphasis
  // surfaces
  bg: '#EEF6FC',
  card: '#FFFFFF',
  fill: '#E4EFF8',
  fill2: '#D6E7F4',
  sep: 'rgba(15,36,64,0.08)',
  // text
  text: '#0F2440',
  text2: '#4E6380',
  text3: '#8DA0B8',
  // status
  green: '#3F9A6E',
  orange: '#E08A3C',
  red: '#D2503F',
  // macros
  protein: '#1F6FB2',
  carbs: '#7CC6F2',
  fat: '#FFB38A',
  water: '#5BB3EA',
}

/** Gradients */
export const G = {
  night: ['#244B80', '#0F2440'] as const, // twilight sky
  day: ['#9BD4F7', '#4FA6E3'] as const, // clear day sky
  dawn: ['#FFE3CC', '#FFB38A', '#F2906B'] as const, // sunrise
}

export const GRADE_COLOR: Record<string, string> = { A: '#4F7D52', B: '#8DA65A', C: '#D2B04C', D: '#C98A3C', E: '#B5483B' }

export const R = { lg: 22, md: 16, sm: 12 }

/** Font families (loaded in app/_layout.tsx) */
export const F = {
  hand: 'Caveat_700Bold',
  handSemi: 'Caveat_600SemiBold',
}

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#0F2440', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 1px 2px rgba(15,36,64,.05), 0 8px 24px rgba(15,36,64,.07)' } as ViewStyle,
})!

export const glow: ViewStyle = Platform.select({
  ios: { shadowColor: '#1F6FB2', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { boxShadow: '0 14px 34px rgba(31,111,178,.28)' } as ViewStyle,
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
