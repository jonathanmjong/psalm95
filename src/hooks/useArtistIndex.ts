import { doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { createSwrResource, swrDoc } from '../lib/swr'
import { useSwrResource } from './useSwrResource'
import type { Artist, Member, Region, ArtistType } from '../types'

/** One entry per artist in the compact `config/artistIndex` doc written by the hourly
 * `recomputeRankings` job — everything list surfaces render, none of the heavy member bios. */
interface ArtistIndexEntry {
  id: string
  name: string
  region: Region
  type: ArtistType
  generationId: string
  rank: number
  compositeScore: number
  weeklyVotes: number
  monthlyVotes: number
  yearlyVotes: number
  metrics: { popularity: number }
  fandomName?: string
  fandomColorName?: string
  fandomColorHex?: string
  topPictureUrls: string[]
  members: Pick<Member, 'memberId' | 'name' | 'birthdate'>[]
}

/** Shapes an index entry into the `Artist` type so consumers (rows, strips, cards) render it
 * with no code changes. Metric values become minimal MetricValue objects; members carry only
 * id/name/birthdate — enough for search, birthdays, and upload tagging. */
function entryToArtist(e: ArtistIndexEntry): Artist {
  const metric = (value: number) => ({ value, source: 'index', updatedAt: '' })
  return {
    ...e,
    metrics: {
      popularity: metric(e.metrics.popularity),
      // Not part of the ranking (or any list surface) anymore — zero-filled to satisfy the type.
      discography: metric(0),
      ticketSales: metric(0),
    },
    members: e.members as Member[],
  }
}

/** Empty value shared across mounts so the effect in useSwrResource has a stable dep. */
const NONE: Artist[] = []

// Module-level resource, same pattern as useAllArtists: one fetch per session, with the
// local cache answering first so a repeat visit renders the roster before the network does.
const index = createSwrResource<Artist[]>((deliver) =>
  swrDoc(
    doc(db, 'config', 'artistIndex'),
    async (snap) => {
      if (snap.exists()) {
        return (snap.data().artists as ArtistIndexEntry[]).map(entryToArtist)
      }
      // The index doc doesn't exist until the first hourly run after deploy — fall back to
      // the full-roster fetch so nothing breaks in the gap.
      const { fetchAllArtists } = await import('./useAllArtists')
      return fetchAllArtists()
    },
    deliver,
  ),
)

/** The compact roster (rank-ordered), from one ~200 KB doc instead of ~1 MB of full artist
 * docs — used by search, the birthdays strip, the daily-heart card, the battle card and the
 * hall-of-fame labels. Up to an hour stale, which every previous consumer already tolerated
 * via the session-long useAllArtists cache. */
export function useArtistIndex() {
  const { data: artists, loading } = useSwrResource(index, NONE)
  return { artists, loading }
}
