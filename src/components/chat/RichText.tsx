import { Text, View } from 'react-native'
import { replyBlocks } from '../../lib/reply'

/**
 * A reply from Breeze, laid out to be read rather than scrolled past: a title,
 * short paragraphs, numbered steps and bullet points, each set apart with room
 * round it, in large type with generous line spacing. Bold marks what the
 * person has to do. The layout is the same wherever Breeze writes: the main
 * chat, and the smaller chats on an exercise or a meal.
 */
export function RichText({ text, color, strong = color, size = 17 }: { text: string; color: string; strong?: string; size?: number }) {
  const line = Math.round(size * 1.55)
  const body = { fontSize: size, lineHeight: line, color, letterSpacing: 0.15 }
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, n) => (n % 2 ? <Text key={n} style={{ fontWeight: '800', color: strong }}>{part}</Text> : part))
  return (
    <View style={{ gap: Math.round(size * 0.6) }}>
      {replyBlocks(text).map((b, i) => {
        if (b.kind === 'title') return <Text key={i} selectable accessibilityRole="header" style={{ fontSize: size + 5, lineHeight: Math.round((size + 5) * 1.3), fontWeight: '800', color: strong, letterSpacing: -0.2 }}>{bold(b.text)}</Text>
        if (b.kind === 'heading') return <Text key={i} selectable accessibilityRole="header" style={{ fontSize: size + 1, lineHeight: line, fontWeight: '800', color: strong, marginTop: i ? 4 : 0 }}>{bold(b.text)}</Text>
        if (b.kind === 'list') {
          return (
            <View key={i} style={{ gap: Math.round(size * 0.45) }}>
              {b.items.map((item, n) => (
                <View key={n} style={{ flexDirection: 'row', gap: 10 }}>
                  {b.ordered
                    ? <Text style={[body, { fontWeight: '800', color: strong, minWidth: size * 1.2, fontVariant: ['tabular-nums'] }]}>{n + 1}.</Text>
                    : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: strong, marginTop: line / 2 - 3, marginHorizontal: 3 }} />}
                  <Text selectable style={[body, { flex: 1 }]}>{bold(item)}</Text>
                </View>
              ))}
            </View>
          )
        }
        return <Text key={i} selectable style={body}>{bold(b.text)}</Text>
      })}
    </View>
  )
}
