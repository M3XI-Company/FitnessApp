import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { C, GRADE_COLOR, R, T, glow, shadow } from '../theme'

export const tap = () => { Haptics.selectionAsync().catch(() => {}) }
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) }

export type IconName = keyof typeof Ionicons.glyphMap
export const Icon = ({ name, size = 20, color = C.text }: { name: IconName; size?: number; color?: string }) => <Ionicons name={name} size={size} color={color} />

/** Large-title scroll screen (Apple style) */
export function Screen({ title, eyebrow, right, children, scroll = true, bottomPad = 130 }: {
  title?: string; eyebrow?: string; right?: ReactNode; children: ReactNode; scroll?: boolean; bottomPad?: number
}) {
  const insets = useSafeAreaInsets()
  const header = title ? (
    <View style={s.nav}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={T.eyebrow}>{eyebrow}</Text> : null}
        <Text style={T.largeTitle}>{title}</Text>
        <View style={s.penStroke} />
      </View>
      {right}
    </View>
  ) : null
  if (!scroll) return <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}><View style={{ paddingHorizontal: 16 }}>{header}</View>{children}</View>
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: bottomPad + insets.bottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {header}
      {children}
    </ScrollView>
  )
}

export function Card({ children, style, onPress, tight }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tight?: boolean }) {
  const body = [s.card, tight && { padding: 14 }, style]
  if (!onPress) return <View style={body}>{children}</View>
  return <Pressable onPress={() => { tap(); onPress() }} style={({ pressed }) => [body, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}>{children}</Pressable>
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionH}>
      <Text style={T.title3}>{title}</Text>
      {action ? <Pressable onPress={onAction} hitSlop={10}><Text style={{ ...T.headline, color: C.accent, fontSize: 15 }}>{action}</Text></Pressable> : null}
    </View>
  )
}

export function Button({ title, onPress, variant = 'primary', icon, style, disabled, small }: {
  title: string; onPress: () => void; variant?: 'primary' | 'dark' | 'tinted' | 'ghost'; icon?: IconName; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean
}) {
  const bg = { primary: C.ink, dark: C.ink, tinted: C.accentSoft, ghost: C.fill }[variant]
  const fg = variant === 'primary' ? C.goldLight : variant === 'dark' ? C.cream : variant === 'tinted' ? C.accent : C.text
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress() }}
      style={({ pressed }) => [s.btn, small && s.btnSm, { backgroundColor: bg }, variant === 'primary' && glow, disabled && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }, style]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16, letterSpacing: 0.2 }}>{title}</Text>
    </Pressable>
  )
}

export function IconButton({ icon, onPress, variant = 'card', size = 38, label }: { icon: IconName; onPress: () => void; variant?: 'card' | 'blue' | 'fill'; size?: number; label?: string }) {
  const bg = variant === 'blue' ? C.ink : variant === 'fill' ? C.fill2 : C.card
  return (
    <Pressable accessibilityLabel={label} onPress={() => { tap(); onPress() }} hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, variant === 'card' && shadow, variant === 'blue' && glow, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={size * 0.5} color={variant === 'blue' ? C.goldLight : C.text} />
    </Pressable>
  )
}

export function Ring({ value, max, size = 120, stroke = 12, color = C.gold, track = C.fill, children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - pct)} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  )
}

export function Bar({ pct, color = C.gold, track = C.fill, height = 8 }: { pct: number; color?: string; track?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ height, width: `${Math.min(100, Math.max(0, pct * 100))}%`, backgroundColor: color, borderRadius: height }} />
    </View>
  )
}

export function Segmented<V extends string>({ value, options, onChange, style }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.seg, style]}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => { tap(); onChange(o.value) }} style={[s.segBtn, value === o.value && s.segOn]}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: value === o.value ? C.text : C.text2 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Chips<V extends string>({ items, value, onChange }: { items: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}>
      {items.map((i) => (
        <Pressable key={i.value} onPress={() => { tap(); onChange(i.value) }} style={[s.chip, value === i.value && { backgroundColor: C.ink }]}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: value === i.value ? C.goldLight : C.text2 }}>{i.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

export function Pill({ children, color = C.accent, bg = C.accentSoft }: { children: ReactNode; color?: string; bg?: string }) {
  return <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 9, height: 24, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{children}</Text></View>
}

export function Grade({ g, size = 30 }: { g?: string; size?: number }) {
  if (!g) return null
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: GRADE_COLOR[g], alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.5 }}>{g}</Text></View>
}

export function IconTile({ icon, emoji, color = C.accent, bg = C.accentSoft, size = 38 }: { icon?: IconName; emoji?: string; color?: string; bg?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.29, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {emoji ? <Text style={{ fontSize: size * 0.52 }}>{emoji}</Text> : icon ? <Ionicons name={icon} size={size * 0.52} color={color} /> : null}
    </View>
  )
}

/** iOS grouped list */
export function List({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.list, style]}>{children}</View>
}
export function Row({ left, title, subtitle, right, onPress, first }: { left?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean }) {
  const content = (
    <>
      {!first && <View style={s.rowSep} />}
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <Text style={T.headline} numberOfLines={1}>{title}</Text> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Text style={T.sub} numberOfLines={1}>{subtitle}</Text> : subtitle) : null}
      </View>
      {right}
    </>
  )
  if (!onPress) return <View style={s.row}>{content}</View>
  return <Pressable onPress={() => { tap(); onPress() }} style={({ pressed }) => [s.row, pressed && { backgroundColor: C.fill }]}>{content}</Pressable>
}

export function Stepper({ value, onChange, step = 1, min = 0, suffix }: { value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string }) {
  // Draft text only while the user is typing; otherwise show the controlled value
  const [draft, setDraft] = useState<string | null>(null)
  const btn = (label: string, fn: () => void) => (
    <Pressable onPress={() => { tap(); setDraft(null); fn() }} style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.6 }]}><Text style={{ fontSize: 22, fontWeight: '500', color: C.text }}>{label}</Text></Pressable>
  )
  return (
    <View style={s.stepper}>
      {btn('−', () => onChange(Math.max(min, +(value - step).toFixed(2))))}
      <TextInput value={draft ?? String(value)} keyboardType="decimal-pad" onChangeText={setDraft} onBlur={() => { if (draft !== null) { const n = parseFloat(draft.replace(',', '.')); onChange(isNaN(n) ? value : n) } setDraft(null) }}
        style={[{ width: 58, textAlign: 'center', fontWeight: '700', fontSize: 18, color: C.text }, T.num]} />
      {suffix ? <Text style={[T.caption, { marginRight: 4 }]}>{suffix}</Text> : null}
      {btn('+', () => onChange(+(value + step).toFixed(2)))}
    </View>
  )
}

export function SearchField({ value, onChangeText, placeholder, autoFocus }: { value: string; onChangeText: (s: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <View style={s.search}>
      <Ionicons name="search" size={18} color={C.text3} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.text3} autoFocus={autoFocus} style={{ flex: 1, fontSize: 16, color: C.text, paddingVertical: 0 }} returnKeyType="search" clearButtonMode="while-editing" />
    </View>
  )
}

export const Field = (props: React.ComponentProps<typeof TextInput>) => (
  <TextInput placeholderTextColor={C.text3} {...props} style={[s.field, props.style as StyleProp<TextStyle>]} />
)

/** Smooth area line chart */
export function LineChart({ data, height = 130, color = C.accent, unit = '', width = 320 }: { data: { value: number }[]; height?: number; color?: string; unit?: string; width?: number }) {
  if (data.length < 2) return <Text style={[T.sub, { textAlign: 'center', paddingVertical: 24 }]}>Log at least two entries to see a trend.</Text>
  const w = width, h = height, pad = 10
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const pts = data.map((d, i) => [pad + (i * (w - pad * 2)) / (data.length - 1), h - pad - ((d.value - min) / span) * (h - pad * 2 - 18)] as const)
  const path = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`
    const [px, py] = pts[i - 1]
    const cx = (px + x) / 2
    return `C${cx},${py} ${cx},${y} ${x},${y}`
  }).join(' ')
  const last = pts[pts.length - 1]
  const lastVal = Math.round(vals[vals.length - 1] * 10) / 10
  return (
    <View>
      <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        <Defs><SvgGrad id="area" x1="0" x2="0" y1="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.22} /><Stop offset="1" stopColor={color} stopOpacity={0} /></SvgGrad></Defs>
        <Path d={`${path} L${last[0]},${h} L${pts[0][0]},${h} Z`} fill="url(#area)" />
        <Path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={last[0]} cy={last[1]} r={5} fill="#fff" stroke={color} strokeWidth={3} />
      </Svg>
      <Text style={[T.caption, { position: 'absolute', right: 0, top: 0, color, fontWeight: '700' }]}>{lastVal}{unit}</Text>
    </View>
  )
}

export function Bars({ data, target, color = C.gold, height = 110 }: { data: { label: string; value: number }[]; target?: number; color?: string; height?: number }) {
  const max = Math.max(target ?? 0, ...data.map((d) => d.value)) || 1
  const inner = height - 22
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {target ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 22 + (target / max) * inner, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: C.accentLine }} /> : null}
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ width: '100%', maxWidth: 26, height: Math.max(4, (d.value / max) * inner), borderRadius: 8, backgroundColor: i === data.length - 1 ? color : color + '55' }} />
          <Text style={T.caption}>{d.label}</Text>
        </View>
      ))}
    </View>
  )
}

/** Fade/slide-in for content */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [a] = useState(() => new Animated.Value(0))
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start() }, [a, delay])
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>
}

/** Header used by modal screens */
export function SheetHeader({ title, onClose, right }: { title: string; onClose: () => void; right?: ReactNode }) {
  return (
    <View style={s.sheetHead}>
      <Text style={T.title2}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {right}
        <IconButton icon="close" variant="fill" size={32} onPress={onClose} label="Close" />
      </View>
    </View>
  )
}

export const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 12, paddingBottom: 14, paddingHorizontal: 4, gap: 12 },
  penStroke: { width: 46, height: 3, borderRadius: 2, backgroundColor: C.gold, marginTop: 2, transform: [{ rotate: '-2deg' }] },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 18, ...shadow },
  sectionH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, marginHorizontal: 4 },
  btn: { height: 52, borderRadius: R.md, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { height: 36, borderRadius: R.sm, paddingHorizontal: 14 },
  seg: { flexDirection: 'row', backgroundColor: C.fill2, borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#fff', ...shadow },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: C.card, justifyContent: 'center', ...shadow },
  list: { backgroundColor: C.card, borderRadius: R.lg, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  rowSep: { position: 'absolute', top: 0, left: 66, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,18,16,0.12)' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.fill, borderRadius: 14, padding: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 12, backgroundColor: C.fill2, paddingHorizontal: 12 },
  field: { height: 50, borderRadius: 14, backgroundColor: C.fill, paddingHorizontal: 16, fontSize: 16, color: C.text },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
})
