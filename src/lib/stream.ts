/**
 * Reading a reply as it is produced. The coach and interview functions can
 * answer with server-sent events: the model's thinking while it works, then
 * one `result` event with the status and body a plain response would carry.
 * Where streaming is not available the same call falls back to a plain
 * request, so callers get the same shape either way.
 */
export interface SseEvent { event: string; data: string }

/** Split what has arrived so far into complete events and the unfinished remainder. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
  const rest = blocks.pop() ?? ''
  for (const block of blocks) {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (data.length) events.push({ event, data: data.join('\n') })
  }
  return { events, rest }
}

export interface Outcome { status: number; body: Record<string, unknown> }

type StreamingFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  status: number; headers: { get(name: string): string | null }; json(): Promise<unknown>
  body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null
}>

/** Expo's fetch can read a response as it arrives; React Native's built-in one cannot. */
function streamingFetch(): StreamingFetch | null {
  try {
    // loaded on demand so code that only imports this file (tests, web) does not need the native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo/fetch') as { fetch: StreamingFetch }).fetch
  } catch {
    return null
  }
}

/**
 * POST `payload` and return the outcome. `onEvent` receives every event that
 * arrives before the result (thinking, early text). When the server or the
 * platform cannot stream, the request is made plainly and no events fire.
 */
export async function postForOutcome(url: string, headers: Record<string, string>, payload: Record<string, unknown>, onEvent: (event: string, data: Record<string, unknown>) => void, signal?: AbortSignal): Promise<Outcome> {
  const stream = streamingFetch()
  if (!stream) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal })
    return { status: res.status, body: await res.json().catch(() => ({})) }
  }
  const res = await stream(url, { method: 'POST', headers, body: JSON.stringify({ ...payload, stream: true }), signal })
  if (!res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let outcome: Outcome | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: true })
    const parsed = parseSse(done ? `${buffer}\n\n` : buffer)
    buffer = parsed.rest
    for (const e of parsed.events) {
      let data: Record<string, unknown>
      try { data = JSON.parse(e.data) } catch { continue }
      if (e.event === 'result') outcome = { status: Number(data.status) || 500, body: (data.body as Record<string, unknown>) ?? {} }
      else onEvent(e.event, data)
    }
    if (done) break
  }
  // the stream ended without a result: treat it as a failed request
  return outcome ?? { status: 502, body: { error: 'incomplete' } }
}
