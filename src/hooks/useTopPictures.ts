import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ArtistPicture } from '../types'

export function useTopPictures(artistId: string, count = 5) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [artistId, count])

  return { pictures, loading }
}
