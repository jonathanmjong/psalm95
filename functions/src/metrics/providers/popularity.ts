import type { MetricProvider } from '../types'
import { spotifyPopularityProvider } from './spotifyPopularity'
import { lastfmPopularityProvider } from './lastfmPopularity'

/** Spotify's `popularity` field is the better signal (a curated 0-100 score) but requires
 * Spotify to approve Extended Quota Mode for this app, which may never happen. Last.fm's
 * raw listener count works today with a self-serve key, so it's the fallback — and becomes
 * the primary signal in practice until/unless Spotify comes through. Both get normalized
 * the same way downstream, so mixing sources across artists within a single ranking run
 * isn't a correctness problem. */
export const popularityProvider: MetricProvider = {
  id: 'popularity',
  async fetch(artist) {
    const spotifyResult = await spotifyPopularityProvider.fetch(artist)
    if (!spotifyResult.stale) return { ...spotifyResult, source: spotifyPopularityProvider.id }
    const lastfmResult = await lastfmPopularityProvider.fetch(artist)
    return { ...lastfmResult, source: lastfmPopularityProvider.id }
  },
}
