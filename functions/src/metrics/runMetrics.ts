import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { spotifyPopularityProvider, spotifyClientId, spotifyClientSecret } from './providers/spotifyPopularity'
import { ticketSalesBandsintownProvider } from './providers/ticketSalesBandsintown'
import { albumsSoldUnassignedProvider } from './providers/albumsSoldUnassigned'
import type { MetricProvider } from './types'

const PROVIDERS: { field: 'popularity' | 'albumsSold' | 'ticketSales'; provider: MetricProvider }[] = [
  { field: 'popularity', provider: spotifyPopularityProvider },
  { field: 'albumsSold', provider: albumsSoldUnassignedProvider },
  { field: 'ticketSales', provider: ticketSalesBandsintownProvider },
]

export const refreshArtistMetrics = onSchedule(
  { schedule: 'every 6 hours', secrets: [spotifyClientId, spotifyClientSecret] },
  async () => {
    const db = getFirestore()
    const artistsSnap = await db.collection('artists').get()
    const now = new Date().toISOString()

    for (const doc of artistsSnap.docs) {
      const artist = { id: doc.id, ...doc.data() } as {
        id: string
        name: string
        spotifyArtistId?: string | null
      }

      const results = await Promise.all(
        PROVIDERS.map(async ({ field, provider }) => {
          const { value, stale } = await provider.fetch(artist)
          return [field, { value, stale, source: provider.id, updatedAt: now }] as const
        }),
      )

      // .update() (not .set + merge) so dotted keys are interpreted as nested field paths.
      const metricsUpdate = Object.fromEntries(results.map(([field, result]) => [`metrics.${field}`, result]))
      await doc.ref.update(metricsUpdate)
    }

    console.log(`Refreshed metrics for ${artistsSnap.size} artists.`)
  },
)
