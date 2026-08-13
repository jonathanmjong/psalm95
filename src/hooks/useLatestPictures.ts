import { useEffect, useRef, useState } from 'react'
import { collection, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'
import type { ArtistPicture } from '../types'

/** The N most recently uploaded pictures for an artist (newest first). */
export function useLatestPictures(artistId: string, count = 10, refreshKey = 0) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [loading, setLoading] = useState(true)
  /** Which artist/count is on screen — see useTopPictures: a refreshKey bump re-reads the
   * same query and must not blank the strip. */
  const shown = useRef<string | null>(null)

  useEffect(() => {
    const key = `${artistId}|${count}`
    if (shown.current !== key) {
      setPictures([])
      shown.current = null
    }
    setLoading(true)
    let active = true
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('uploadedAt', 'desc'),
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
      // A refresh follows an upload or a delete — the cache predates it.
      { serverOnly: refreshKey > 0 },
    ).catch(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [artistId, count, refreshKey])

  return { pictures, loading }
}
