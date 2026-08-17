import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { popularityProvider } from './providers/popularity'
import { spotifyClientId, spotifyClientSecret } from './providers/spotifyPopularity'
import { lastfmApiKey } from './providers/lastfmPopularity'
import type { MetricArtist, MetricProvider } from './types'

// Discography (MusicBrainz) and ticket sales (Ticketmaster) were dropped from the ranking
// formula in Aug 2026 and are no longer collected — their providers remain in ./providers if
// they're ever scored again, and the last-fetched values stay frozen on the artist docs.
const PROVIDERS: { field: 'popularity'; provider: MetricProvider }[] = [
  { field: 'popularity', provider: popularityProvider },
]

/**
 * How many artists are processed at once. Popularity now leads with Wikipedia pageviews, which
 * on a cold roster has to resolve each artist's Wikidata entity (several throttled MediaWiki
 * calls) before it can read any views. Measured against the live 107-artist roster with
 * scripts/check-popularity.mjs: 7.3s/artist cold, 0.3s/artist warm. Requests to Wikimedia are
 * rate-limited by a module-global gate inside the provider, so widening this shortens wall time
 * without raising the request rate Wikimedia sees.
 */
const ARTIST_CONCURRENCY = 4

export const refreshArtistMetrics = onSchedule(
  {
    schedule: 'every 6 hours',
    secrets: [spotifyClientId, spotifyClientSecret, lastfmApiKey],
    /**
     * The old 300s was sized for Deezer-only, which was one request per artist. Measured on the
     * live roster: a warm run (article titles already cached on the artist docs) is ~35s — two
     * throttled pageview calls per artist and nothing else. A cold run — first deploy, plus any
     * later run for artists whose titles are still missing — pays for Wikidata resolution too:
     * 784s of work, which came in at 197-217s wall clock at the concurrency above. 900s covers a
     * fully cold roster even if concurrency were dropped to 1, leaves room for Wikimedia backing
     * us off, and still sits well under the 3600s v2 ceiling.
     */
    timeoutSeconds: 900,
  },
  async () => {
    const db = getFirestore()
    const artistsSnap = await db.collection('artists').get()
    const now = new Date().toISOString()

    let failures = 0
    const bySource = new Map<string, number>()

    const refreshOne = async (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      const artist: MetricArtist = {
        id: doc.id,
        name: data.name,
        region: data.region,
        type: data.type,
        spotifyArtistId: data.spotifyArtistId ?? null,
        wikiArticles: data.wikiArticles ?? null,
      }

      try {
        const results = await Promise.all(
          PROVIDERS.map(async ({ field, provider }) => {
            const { value, stale, source, patch } = await provider.fetch(artist)
            return [field, { value, stale, source: source ?? provider.id, updatedAt: now }, patch] as const
          }),
        )

        // .update() (not .set + merge) so dotted keys are interpreted as nested field paths.
        const update: Record<string, unknown> = {}
        for (const [field, result, patch] of results) {
          update[`metrics.${field}`] = result
          // Providers hand back top-level doc fields worth persisting (the Wikipedia article
          // titles they resolved), so the next run can skip the lookup entirely.
          Object.assign(update, patch ?? {})
          bySource.set(
            `${result.source}${result.stale ? ' (stale)' : ''}`,
            (bySource.get(`${result.source}${result.stale ? ' (stale)' : ''}`) ?? 0) + 1,
          )
        }
        await doc.ref.update(update)
      } catch (err) {
        failures++
        console.error(`Failed to refresh metrics for artist ${artist.id}:`, err)
      }
    }

    for (let i = 0; i < artistsSnap.docs.length; i += ARTIST_CONCURRENCY) {
      await Promise.all(artistsSnap.docs.slice(i, i + ARTIST_CONCURRENCY).map(refreshOne))
    }

    const breakdown = [...bySource.entries()].map(([source, count]) => `${source}=${count}`).join(', ')
    console.log(
      `Refreshed metrics for ${artistsSnap.size - failures}/${artistsSnap.size} artists. Sources: ${breakdown}`,
    )
  },
)
