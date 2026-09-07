import { recordVisit } from './callables'

/**
 * Fires once per browser session to record which channel sent this visit. Uses
 * sessionStorage rather than a cookie, sends no identifier, and the server only ever keeps
 * per-day counts per source — so this is attribution without tracking anyone.
 */
const SESSION_KEY = 'psalmtune:visit-recorded'

export function recordVisitOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Private browsing with storage disabled — skip rather than double-count every render.
    return
  }

  const params = new URLSearchParams(window.location.search)
  // An explicit campaign tag wins; otherwise fall back to the referring host.
  const source = params.get('utm_source') ?? referrerHost()
  void recordVisit({ source, landing: window.location.pathname }).catch(() => {
    // Attribution is best-effort — it must never affect what the visitor sees.
  })
}

function referrerHost(): string | undefined {
  if (!document.referrer) return undefined
  try {
    const host = new URL(document.referrer).hostname
    // Internal navigation isn't a new visit source.
    return host === window.location.hostname ? undefined : host
  } catch {
    return undefined
  }
}
