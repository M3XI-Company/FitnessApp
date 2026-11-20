/**
 * Reading a reply from Breeze into the pieces it is laid out in. The coach
 * writes plain text with a little markup: "# Title" on the first line,
 * "## Heading" for a part, "1." for steps, "-" for points and **bold** for
 * the words that carry the instruction. Kept apart from the screen so it can
 * be tested.
 */
export type ReplyBlock =
  | { kind: 'title' | 'heading' | 'text'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }

export function replyBlocks(text: string): ReplyBlock[] {
  const out: ReplyBlock[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { out.push({ kind: 'text', text: para.join(' ') }); para = [] } }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const head = /^(#{1,3})\s+(.+)$/.exec(line)
    const step = /^(\d{1,2})[.)]\s+(.+)$/.exec(line)
    const point = /^[-•*]\s+(.+)$/.exec(line)
    if (head) {
      flush()
      // the first thing in a reply is its title; anything after is a heading for a part
      out.push({ kind: head[1].length === 1 && !out.length ? 'title' : 'heading', text: head[2] })
    } else if (step || point) {
      flush()
      const ordered = !!step
      const item = (step ? step[2] : point![1]).trim()
      const last = out[out.length - 1]
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item)
      else out.push({ kind: 'list', ordered, items: [item] })
    } else {
      // a line of its own is a paragraph of its own: the coach writes one thought a line
      flush()
      para.push(line)
    }
  }
  flush()
  return out
}

/** The reply as it is spoken or copied: the words alone, a step or point per sentence. */
export const plainReply = (text: string) => replyBlocks(text)
  .map((b) => (b.kind === 'list' ? b.items.map((t, i) => (b.ordered ? `${i + 1}. ${t}` : t)).join('\n') : b.text))
  .join('\n\n')
  .replace(/\*\*(.+?)\*\*/g, '$1')
