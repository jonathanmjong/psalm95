import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'

// Module-level cache: the full roster is small (~107 docs) and rarely changes within a
// session, so fetch it once and reuse across keystrokes and route visits.
let cache: Promise<Artist[]> | null = null

export function fetchAllArtists(): Promise<Artist[]> {
  if (!cache) {
    cache = getDocs(query(collection(db, 'artists'), orderBy('compositeScore', 'desc'), orderBy('name', 'asc')))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Artist))
      .catch((err) => {
        cache = null // allow a retry on failure
        throw err
      })
  }
  return cache
}

/** Loads the entire artist roster (cached) — used for instant client-side search. */
export function useAllArtists() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchAllArtists()
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
