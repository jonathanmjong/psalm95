import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'

export function useArtist(artistId: string | undefined) {
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistId) return
    setLoading(true)
    return onSnapshot(doc(db, 'artists', artistId), (snap) => {
      setArtist(snap.exists() ? ({ id: snap.id, ...snap.data() } as Artist) : null)
      setLoading(false)
    })
  }, [artistId])

  return { artist, loading }
}
