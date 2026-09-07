import { collection, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { createSwrResource, swrQuery } from '../lib/swr'
import { useSwrResource } from './useSwrResource'
import type { Artist } from '../types'

/** Empty value shared across mounts so the effect in useSwrResource has a stable dep. */
const NONE: Artist[] = []

// Module-level resource: the full roster is small (~107 docs) and rarely changes within a
// session, so fetch it once and reuse across keystrokes and route visits. The SWR layer
// sits inside it — the local cache answers first, the server read follows.
const roster = createSwrResource<Artist[]>((deliver) =>
  swrQuery(
    query(collection(db, 'artists'), orderBy('compositeScore', 'desc'), orderBy('name', 'asc')),
    (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Artist),
    deliver,
  ),
)

/** Resolves with the fresh (server) roster; deduped for the whole session. */
export function fetchAllArtists(): Promise<Artist[]> {
  return roster.load()
}

/** Loads the entire artist roster (cached) — used for instant client-side search. */
export function useAllArtists() {
  const { data: artists, loading } = useSwrResource(roster, NONE)
  return { artists, loading }
}
