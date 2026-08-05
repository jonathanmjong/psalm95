import type { MetricProvider } from '../types'
import { spotifyPopularityProvider } from './spotifyPopularity'
import { deezerPopularityProvider } from './deezerPopularity'
import { lastfmPopularityProvider } from './lastfmPopularity'

/** Tries each popularity source in order and uses the first that isn't stale:
 * 1. Spotify — best signal (curated 0-100 score), but blocked on Spotify approving
 *    Extended Quota Mode for this app, which may never happen.
 * 2. Deezer — no API key needed at all, works today with zero setup.
 * 3. Last.fm — needs a self-serve key (pending); kept as a further fallback.
 * Both get normalized the same way downstream, so mixing sources across artists within
 * a single ranking run isn't a correctness problem. */
const CHAIN = [spotifyPopularityProvider, deezerPopularityProvider, lastfmPopularityProvider]

export const popularityProvider: MetricProvider = {
  id: 'popularity',
  async fetch(artist) {
    for (const provider of CHAIN) {
      const result = await provider.fetch(artist)
      if (!result.stale) return { ...result, source: provider.id }
    }
    return { value: 0, stale: true }
  },
}
