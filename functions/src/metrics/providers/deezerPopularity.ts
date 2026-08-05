import type { MetricProvider } from '../types'

interface DeezerArtist {
  name: string
  nb_fan: number
}

/** Deezer's public search API needs no API key at all — no signup, no approval wait, works
 * immediately. Uses `nb_fan` (follower count) as the popularity signal.
 *
 * Search results include unrelated artists that merely fuzzy-match the query (e.g. searching
 * "STAYC" surfaces jazz singer "Stacey Kent", who has *more* fans than the real STAYC) — so
 * this only accepts case-insensitive exact name matches, then picks the most-followed one
 * among those (handles cover bands/tribute acts sharing the real artist's name). If nothing
 * matches exactly, it reports stale rather than guessing. */
export const deezerPopularityProvider: MetricProvider = {
  id: 'deezer',
  async fetch(artist) {
    try {
      const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist.name)}&limit=15`)
      if (!res.ok) return { value: 0, stale: true }
      const json = (await res.json()) as { data?: DeezerArtist[] }
      const exactMatches = (json.data ?? []).filter((a) => a.name.toLowerCase() === artist.name.toLowerCase())
      if (exactMatches.length === 0) return { value: 0, stale: true }

      const best = exactMatches.reduce((a, b) => (b.nb_fan > a.nb_fan ? b : a))
      if (best.nb_fan <= 0) return { value: 0, stale: true }
      return { value: best.nb_fan, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
