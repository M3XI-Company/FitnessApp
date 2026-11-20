import { Text, View } from 'react-native'
import { replyBlocks, replySpans } from '../../lib/reply'
import { C } from '../../theme'

/**
 * A reply from Breeze, set out on the page to be read, never in a bubble.
 * The sizes do the work a bubble cannot: a large title, an opening line a
 * step up from the rest, headings for the parts, steps and points with room
 * round them, and a smaller italic line for an aside. Inside a line, bold is
 * the thing to do, italics the reason or the stress, and a coloured number is
 * one that matters. The layout is the same wherever Breeze writes.
 */
export function RichText({ text, color, strong = color, size = 17 }: { text: string; color: string; strong?: string; size?: number }) {
  const line = Math.round(size * 1.55)
  const body = { fontSize: size, lineHeight: line, color, letterSpacing: 0.15 }
  // on a dark card the marked numbers are drawn in the pale sky colour, on the page in the deep one
  const mark = strong === '#fff' ? C.skyLight : C.accent
  const spans = (s: string) => replySpans(s).map((p, n) => (
    p.style === 'bold' ? <Text key={n} style={{ fontWeight: '800', color: strong }}>{p.text}</Text>
      : p.style === 'italic' ? <Text key={n} style={{ fontStyle: 'italic' }}>{p.text}</Text>
        : p.style === 'mark' ? <Text key={n} style={{ fontWeight: '800', color: mark }}>{p.text}</Text>
          : p.text
  ))
  const blocks = replyBlocks(text)
  // the opening line of a longer reply is set a step larger, the way a standfirst is
  const lead = blocks.length > 2 ? blocks.findIndex((b) => b.kind === 'text') : -1
  return (
    <View style={{ gap: Math.round(size * 0.65) }}>
      {blocks.map((b, i) => {
        if (b.kind === 'title') return <Text key={i} selectable accessibilityRole="header" style={{ fontSize: size + 10, lineHeight: Math.round((size + 10) * 1.2), fontWeight: '800', color: strong, letterSpacing: -0.5 }}>{spans(b.text)}</Text>
        if (b.kind === 'heading') return <Text key={i} selectable accessibilityRole="header" style={{ fontSize: size - 3, lineHeight: line, fontWeight: '800', color: mark, letterSpacing: 1.1, textTransform: 'uppercase', marginTop: i ? 8 : 0 }}>{spans(b.text)}</Text>
        if (b.kind === 'note') return <Text key={i} selectable style={{ fontSize: size - 2, lineHeight: Math.round((size - 2) * 1.5), fontStyle: 'italic', color, opacity: 0.72, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: mark }}>{spans(b.text)}</Text>
        if (b.kind === 'list') {
          return (
            <View key={i} style={{ gap: Math.round(size * 0.5) }}>
              {b.items.map((item, n) => (
                <View key={n} style={{ flexDirection: 'row', gap: 10 }}>
                  {b.ordered
                    ? <Text style={[body, { fontWeight: '800', color: mark, minWidth: size * 1.2, fontVariant: ['tabular-nums'] }]}>{n + 1}.</Text>
                    : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: mark, marginTop: line / 2 - 3, marginHorizontal: 3 }} />}
                  <Text selectable style={[body, { flex: 1 }]}>{spans(item)}</Text>
                </View>
              ))}
            </View>
          )
        }
        if (i === lead) return <Text key={i} selectable style={{ fontSize: size + 3, lineHeight: Math.round((size + 3) * 1.45), color: strong, fontWeight: '500', letterSpacing: 0 }}>{spans(b.text)}</Text>
        return <Text key={i} selectable style={body}>{spans(b.text)}</Text>
      })}
    </View>
  )
}
