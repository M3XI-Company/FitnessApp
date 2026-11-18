/**
 * Reading the address Google sign-in comes back to the app on. Kept apart from
 * the sign-in code so it can be checked without a phone.
 */

export type RedirectOutcome = { ok: true; accessToken: string; refreshToken: string } | { ok: false; reason: 'cancelled' | 'failed'; detail?: string }

/** The parts of an address after "?" and after "#", as one set of names and values. */
function params(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [k, v = ''] = pair.split('=')
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
    }
  }
  return out
}

/** What the address the browser handed back means: the session's two tokens, or why there are none. */
export function readRedirect(url: string | undefined): RedirectOutcome {
  if (!url) return { ok: false, reason: 'cancelled' }
  const p = params(url)
  if (p.error || p.error_code) return { ok: false, reason: p.error === 'access_denied' ? 'cancelled' : 'failed', detail: p.error_description || p.error || p.error_code }
  if (p.access_token && p.refresh_token) return { ok: true, accessToken: p.access_token, refreshToken: p.refresh_token }
  return { ok: false, reason: 'failed', detail: 'No session came back.' }
}
