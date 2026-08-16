import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'

/** A Firestore document id can't contain a slash, and `doc()` throws synchronously if it
 * does — which took the whole app down before an error boundary existed. An id like this
 * can never match a document, so treat it as "not found" rather than an error. */
function isValidArtistId(id: string): boolean {
  return id.length > 0 && id.length <= 1500 && !id.includes('/')
}

export function useArtist(artistId: string | undefined) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  /** Set when the backend can't be reached, so the page can say so instead of claiming the
   * artist doesn't exist — a soft 404 on an outage misleads users and search engines alike. */
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!artistId) return
    if (!isValidArtistId(artistId)) {
      setArtist(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    return onSnapshot(
      doc(db, 'artists', artistId),
      (snap) => {
        // A miss served from cache only means "we haven't heard from the server", not that
        // the artist is gone; waiting for the server answer avoids flashing a false 404.
        if (!snap.exists() && snap.metadata.fromCache) return
        setArtist(snap.exists() ? ({ id: snap.id, ...snap.data() } as Artist) : null)
        setLoading(false)
      },
      () => {
        // Permission or transport failure: stop loading and report it honestly.
        setError(true)
        setLoading(false)
      },
    )
  }, [artistId])

  return { artist, loading, error }
}
