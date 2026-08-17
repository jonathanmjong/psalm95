import type { MetricProvider } from '../types'
import { wikipediaPopularityProvider } from './wikipediaPopularity'
import { spotifyPopularityProvider } from './spotifyPopularity'
import { deezerPopularityProvider } from './deezerPopularity'
import { lastfmPopularityProvider } from './lastfmPopularity'

/** Tries each popularity source in order and uses the first that isn't stale:
 *
 * 1. Wikipedia pageviews — the source that actually carries the ranking. Free, no key, and a
 *    measure of *current* attention rather than a lifetime follower total. Resolves the article
 *    through the Wikidata identity gate, so it is not guessing titles.
 * 2. Deezer — no API key, works today, kept as the fallback for artists with no verifiable
 *    Wikidata entity. Its `nb_fan` is a lifetime follower count on a catalog with a
 *    legacy/Western-adjacent skew, which is why it is no longer first: it ranked 2NE1
 *    (disbanded 2016, 403,912 fans) above NewJeans (345,582) and Rainbow above IVE.
 * 3. Spotify — DEAD, not pending. `GET /v1/artists/{id}` now returns only
 *    `external_urls, href, id, images, name, type, uri` for apps without Extended Quota Mode:
 *    no `popularity`, no `followers`, no `genres`. The credentials still authenticate, so this
 *    fails quietly by always reporting stale. Kept wired up so that if the quota is ever
 *    granted the field simply reappears and this starts contributing again.
 * 4. Last.fm — INERT. The configured LASTFM_API_KEY is not a valid key (17 chars against the
 *    real 32; the API answers `{"message":"Invalid API key","error":10}`), so this always
 *    reports stale. Kept wired up so a corrected key needs no code change.
 *
 * Caveat worth knowing: the sources are on completely different scales (pageviews vs follower
 * counts vs a 0-100 index) and `ranking/recompute.ts` min-max normalizes the mixed column as if
 * it were one scale. That is tolerable only while nearly every artist comes from the same
 * source — see the fallback count logged by `runMetrics`. */
const CHAIN = [
  wikipediaPopularityProvider,
  deezerPopularityProvider,
  spotifyPopularityProvider,
  lastfmPopularityProvider,
]

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
