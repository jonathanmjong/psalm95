import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'

/** The vote counters the fandom board can rank by. These are raw counters that Cloud
 * Functions increment on every cast vote — unlike `compositeScore`/`rank`, which are
 * recomputed hourly and must never be animated as if a single vote moved them. */
export type VotePeriodField = 'weeklyVotes' | 'monthlyVotes' | 'yearlyVotes'

/** Hard cap on the live listener's result set. A snapshot listener re-delivers changed
 * docs for as long as the page is open, so the slice is bounded on purpose. 120 covers
 * the entire current roster (~107 artists, ~99 with a fandom), i.e. the board is
 * complete today; if the roster grows past this the tail simply isn't on the board. */
const RACE_LIMIT = 120

/**
 * Live top slice of the artist roster for the fandom leaderboard, ordered by the raw
 * vote counter for the selected period.
 *
 * Query shape is deliberately single-field (`orderBy(field, 'desc')` + `limit`) so it is
 * served by Firestore's automatic single-field indexes — no composite index, nothing to
 * add to firestore.indexes.json. "Has a fandom" cannot be expressed as a query
 * constraint anyway (there is no field-exists operator), so that filter is applied
 * client-side over the returned slice.
 */
export function useLiveFandomRace(field: VotePeriodField) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Note: `loading` is intentionally not reset when `field` changes. Every artist doc
    // already carries all three counters, so the previous snapshot renders the new
    // period correctly and the list re-sorts instead of flashing a spinner.
    const q = query(collection(db, 'artists'), orderBy(field, 'desc'), limit(RACE_LIMIT))
    return onSnapshot(
      q,
      (snap) => {
        setArtists(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Artist)
            .filter((a) => Boolean(a.fandomName)),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [field])

  return { artists, loading }
}
