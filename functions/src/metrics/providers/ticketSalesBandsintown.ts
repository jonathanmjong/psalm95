import type { MetricProvider } from '../types'

const APP_ID = 'psalm95'

/** Best-effort ticket-demand proxy: Bandsintown's public events endpoint doesn't expose
 * actual sales/revenue (that data is proprietary, e.g. Billboard Boxscore), so this counts
 * an artist's currently-listed upcoming tour dates as a rough stand-in. Real "tickets sold"
 * would replace this provider wholesale without touching the ranking pipeline. */
export const ticketSalesBandsintownProvider: MetricProvider = {
  id: 'bandsintown-upcoming-events',
  async fetch(artist) {
    try {
      const res = await fetch(
        `https://rest.bandsintown.com/artists/${encodeURIComponent(artist.name)}/events?app_id=${APP_ID}`,
      )
      if (!res.ok) return { value: 0, stale: true }
      const events = (await res.json()) as unknown
      if (!Array.isArray(events)) return { value: 0, stale: true }
      return { value: events.length, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
