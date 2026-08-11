import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ArtistPicture } from '../types'

export function useTopPictures(artistId: string, count = 5, refreshKey = 0, enabled = true) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Disabled when the caller already has denormalized URLs (artist.topPictureUrls) —
    // skipping the query is the point, not an optimization.
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('voteCount', 'desc'),
      limit(count),
    )
    getDocs(q)
      .then((snap) => {
        setPictures(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ArtistPicture))
      })
      .finally(() => setLoading(false))
  }, [artistId, count, refreshKey, enabled])

  return { pictures, loading }
}
