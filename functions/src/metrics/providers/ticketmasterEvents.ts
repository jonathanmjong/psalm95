import { defineSecret } from 'firebase-functions/params'
import type { MetricProvider } from '../types'

export const ticketmasterApiKey = defineSecret('TICKETMASTER_API_KEY')

interface DiscoveryResponse {
  _embedded?: { events?: { id: string }[] }
  page?: { totalElements?: number }
}

/** Ticket-demand proxy: Ticketmaster doesn't expose actual sales/revenue (that's proprietary,
 * e.g. Billboard Boxscore), so this counts currently-listed upcoming events matching the
 * artist as a rough stand-in. Replaced Bandsintown's undocumented app_id convention after
 * Bandsintown started rejecting it outright (403 AccessDeniedException) — Ticketmaster's
 * Discovery API is a proper self-serve free-tier key instead. */
export const ticketmasterEventsProvider: MetricProvider = {
  id: 'ticketmaster-upcoming-events',
  async fetch(artist) {
    const apiKey = ticketmasterApiKey.value()
    if (!apiKey) return { value: 0, stale: true }

    try {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(
        artist.name,
      )}&classificationName=music&apikey=${apiKey}`
      const res = await fetch(url)
      if (!res.ok) return { value: 0, stale: true }
      const json = (await res.json()) as DiscoveryResponse
      const count = json.page?.totalElements ?? json._embedded?.events?.length ?? 0
      return { value: count, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
