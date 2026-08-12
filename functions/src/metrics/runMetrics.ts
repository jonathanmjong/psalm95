import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { popularityProvider } from './providers/popularity'
import { spotifyClientId, spotifyClientSecret } from './providers/spotifyPopularity'
import { lastfmApiKey } from './providers/lastfmPopularity'
import type { MetricProvider } from './types'

// Discography (MusicBrainz) and ticket sales (Ticketmaster) were dropped from the ranking
// formula in Aug 2026 and are no longer collected — their providers remain in ./providers if
// they're ever scored again, and the last-fetched values stay frozen on the artist docs.
const PROVIDERS: { field: 'popularity'; provider: MetricProvider }[] = [
  { field: 'popularity', provider: popularityProvider },
]

export const refreshArtistMetrics = onSchedule(
  {
    schedule: 'every 6 hours',
    secrets: [spotifyClientId, spotifyClientSecret, lastfmApiKey],
    // Popularity-only is quick (no MusicBrainz 1.1s/artist throttle anymore), but leave slack
    // for provider fallbacks across the whole roster.
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore()
    const artistsSnap = await db.collection('artists').get()
    const now = new Date().toISOString()

    let failures = 0
    for (const doc of artistsSnap.docs) {
      const artist = { id: doc.id, ...doc.data() } as {
        id: string
        name: string
        spotifyArtistId?: string | null
      }

      try {
        const results = await Promise.all(
          PROVIDERS.map(async ({ field, provider }) => {
            const { value, stale, source } = await provider.fetch(artist)
            return [field, { value, stale, source: source ?? provider.id, updatedAt: now }] as const
          }),
        )

        // .update() (not .set + merge) so dotted keys are interpreted as nested field paths.
        const metricsUpdate = Object.fromEntries(results.map(([field, result]) => [`metrics.${field}`, result]))
        await doc.ref.update(metricsUpdate)
      } catch (err) {
        failures++
        console.error(`Failed to refresh metrics for artist ${artist.id}:`, err)
      }
    }

    console.log(`Refreshed metrics for ${artistsSnap.size - failures}/${artistsSnap.size} artists.`)
  },
)
