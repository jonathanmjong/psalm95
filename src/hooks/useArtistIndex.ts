import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
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
  metrics: { popularity: number; discography: number; ticketSales: number }
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
      discography: metric(e.metrics.discography),
      ticketSales: metric(e.metrics.ticketSales),
    },
    members: e.members as Member[],
  }
}

// Module-level cache, same pattern as useAllArtists: one fetch per session.
let cache: Promise<Artist[]> | null = null

function fetchIndex(): Promise<Artist[]> {
  if (!cache) {
    cache = getDoc(doc(db, 'config', 'artistIndex'))
      .then(async (snap) => {
        if (snap.exists()) {
          return (snap.data().artists as ArtistIndexEntry[]).map(entryToArtist)
        }
        // The index doc doesn't exist until the first hourly run after deploy — fall back to
        // the full-roster fetch so nothing breaks in the gap.
        const { fetchAllArtists } = await import('./useAllArtists')
        return fetchAllArtists()
      })
      .catch((err) => {
        cache = null // allow a retry on failure
        throw err
      })
  }
  return cache
}

/** The compact roster (rank-ordered), from one ~200 KB doc instead of ~1 MB of full artist
 * docs — used by search, the birthdays strip, the daily-heart card, the battle card and the
 * hall-of-fame labels. Up to an hour stale, which every previous consumer already tolerated
 * via the session-long useAllArtists cache. */
export function useArtistIndex() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchIndex()
      .then((all) => {
        if (active) setArtists(all)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { artists, loading }
}
