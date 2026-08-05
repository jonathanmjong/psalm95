import { defineSecret } from 'firebase-functions/params'
import type { MetricProvider } from '../types'

export const lastfmApiKey = defineSecret('LASTFM_API_KEY')

/** Last.fm's `artist.getinfo` listener count. Free, self-serve API key (no approval wait,
 * unlike Spotify's Extended Quota Mode), so this is the popularity source that actually
 * works today. Matches by artist name — Last.fm has no stable per-artist id to key off of
 * like Spotify does, so a same-named different artist is a small, accepted risk. */
export const lastfmPopularityProvider: MetricProvider = {
  id: 'lastfm',
  async fetch(artist) {
    const apiKey = lastfmApiKey.value()
    if (!apiKey) return { value: 0, stale: true }

    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(
        artist.name,
      )}&api_key=${apiKey}&format=json`
      const res = await fetch(url)
      if (!res.ok) return { value: 0, stale: true }
      const json = (await res.json()) as { artist?: { stats?: { listeners?: string } } }
      const listeners = Number(json.artist?.stats?.listeners)
      if (!Number.isFinite(listeners) || listeners <= 0) return { value: 0, stale: true }
      return { value: listeners, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
