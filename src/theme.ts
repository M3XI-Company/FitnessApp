import { Platform, type TextStyle, type ViewStyle } from 'react-native'

export const C = {
  blue: '#0A6CFF',
  blue600: '#0057E0',
  blue700: '#0047CC',
  blue50: '#EAF2FF',
  blue100: '#D6E6FF',
  sky: '#38BDF8',
  indigo: '#6366F1',
  navy: '#0B1B3A',
  bg: '#F2F5FA',
  card: '#FFFFFF',
  text: '#0B1220',
  text2: '#5B6475',
  text3: '#98A1B2',
  sep: 'rgba(15,30,60,0.08)',
  fill: '#EEF2F8',
  fill2: '#E3E8F0',
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
  protein: '#0A6CFF',
  carbs: '#38BDF8',
  fat: '#6366F1',
}

export const GRADE_COLOR: Record<string, string> = { A: '#1B8F4E', B: '#6CBF3B', C: '#E9B820', D: '#EE8A2A', E: '#E1462E' }

export const R = { lg: 22, md: 16, sm: 12 }

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#0F1E3C', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: { boxShadow: '0 1px 2px rgba(15,30,60,.04), 0 8px 24px rgba(15,30,60,.06)' } as ViewStyle,
})!

export const blueGlow: ViewStyle = Platform.select({
  ios: { shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 8 },
  default: { boxShadow: '0 14px 36px rgba(10,108,255,.35)' } as ViewStyle,
})!

const t = (fontSize: number, fontWeight: TextStyle['fontWeight'], letterSpacing = 0, color = C.text): TextStyle =>
  ({ fontSize, fontWeight, letterSpacing, color })

export const T = {
  largeTitle: t(34, '800', -0.8),
  title1: t(28, '800', -0.6),
  title2: t(22, '700', -0.4),
  title3: t(18, '700', -0.3),
  headline: t(16, '600', -0.2),
  body: t(15, '400', -0.1),
  sub: t(13, '500', 0, C.text2),
  caption: t(12, '500', 0, C.text3),
  eyebrow: { ...t(12, '700', 0.8, C.text3), textTransform: 'uppercase' } as TextStyle,
  num: { fontVariant: ['tabular-nums'] } as TextStyle,
}
