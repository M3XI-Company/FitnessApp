import { Text } from 'react-native'

/**
 * A reply from Breeze with its two kinds of emphasis: a title line (written
 * "# Title") and bold words (written between pairs of asterisks). The bold is
 * what the person has to do; everything else is ordinary weight, so the
 * instruction can be found at a glance.
 */
export function RichText({ text, color, strong = color, size = 15 }: { text: string; color: string; strong?: string; size?: number }) {
  const lines = text.split('\n')
  return (
    <Text selectable style={{ fontSize: size, lineHeight: Math.round(size * 1.4), color }}>
      {lines.map((line, i) => {
        const title = /^#{1,3}\s+(.*)$/.exec(line)
        const parts = (title ? title[1] : line).split(/\*\*(.+?)\*\*/g)
        return (
          <Text key={i} style={title ? { fontWeight: '800', fontSize: size + 2, color: strong } : undefined}>
            {parts.map((part, n) => (n % 2 ? <Text key={n} style={{ fontWeight: '800', color: strong }}>{part}</Text> : part))}
            {i < lines.length - 1 ? '\n' : ''}
          </Text>
        )
      })}
    </Text>
  )
}
