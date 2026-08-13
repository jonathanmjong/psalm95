import { useEffect, useRef, useState } from 'react'
import { collection, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'
import type { ArtistPicture } from '../types'

export function useTopPictures(artistId: string, count = 5, refreshKey = 0, enabled = true) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [loading, setLoading] = useState(true)
  /** Which artist/count is on screen. A bumped refreshKey re-reads the *same* query after a
   * mutation, so the strip stays up and simply re-sorts when the fresh docs land. */
  const shown = useRef<string | null>(null)

  useEffect(() => {
    // Disabled when the caller already has denormalized URLs (artist.topPictureUrls) —
    // skipping the query is the point, not an optimization.
    if (!enabled) {
      setLoading(false)
      return
    }
    const key = `${artistId}|${count}`
    if (shown.current !== key) {
      setPictures([])
      shown.current = null
    }
    setLoading(true)
    let active = true
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('voteCount', 'desc'),
      limit(count),
    )
    swrQuery(
      q,
      (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArtistPicture),
      (docs) => {
        if (!active) return
        setPictures(docs)
        setLoading(false)
        shown.current = key
      },
      // A refresh follows a heart vote, an upload or a delete: the cached docs still carry
      // the old vote counts, so re-reading them would look like the vote reverted.
      { serverOnly: refreshKey > 0 },
    ).catch(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [artistId, count, refreshKey, enabled])

  return { pictures, loading }
}
