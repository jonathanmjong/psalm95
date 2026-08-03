import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'

const PAGE_SIZE = 12

export function useArtists(generationId: string | null) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const cursors = useRef<QueryDocumentSnapshot[]>([])

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      const constraints = [
        ...(generationId ? [where('generationId', '==', generationId)] : []),
        orderBy('compositeScore', 'desc'),
        orderBy('name', 'asc'),
      ]
      const cursor = targetPage > 0 ? cursors.current[targetPage - 1] : undefined
      const q = query(
        collection(db, 'artists'),
        ...constraints,
        ...(cursor ? [startAfter(cursor)] : []),
        limit(PAGE_SIZE + 1),
      )
      const snap = await getDocs(q)
      const docs = snap.docs.slice(0, PAGE_SIZE)
      if (docs.length > 0) cursors.current[targetPage] = docs[docs.length - 1]
      setArtists(docs.map((d) => ({ id: d.id, ...d.data() }) as Artist))
      setHasMore(snap.docs.length > PAGE_SIZE)
      setPage(targetPage)
      setLoading(false)
    },
    [generationId],
  )

  useEffect(() => {
    cursors.current = []
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId])

  return {
    artists,
    loading,
    page,
    hasMore,
    nextPage: () => load(page + 1),
    prevPage: () => load(Math.max(0, page - 1)),
  }
}
