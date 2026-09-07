import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'
import type { Artist } from '../types'

const PAGE_SIZE = 12

export function useArtists(generationId: string | null) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  /** A failed fetch must not render as 'No artists found for this generation yet.' */
  const [error, setError] = useState(false)
  const cursors = useRef<QueryDocumentSnapshot[]>([])
  /** Bumped per load so a slow delivery (cached or fresh) from a superseded request —
   * generation switched, page changed — can't write stale rows. */
  const request = useRef(0)
  /** Generation whose rows are currently on screen, so we only blank the list when the
   * data set actually changes rather than on every re-read. */
  const shown = useRef<string | null | undefined>(undefined)

  const load = useCallback(
    async (targetPage: number) => {
      const id = ++request.current
      if (shown.current !== generationId) {
        setArtists([])
        shown.current = undefined
      }
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
      await swrQuery(
        q,
        (snap) => snap,
        (snap) => {
          if (id !== request.current) return
          const docs = snap.docs.slice(0, PAGE_SIZE)
          if (docs.length > 0) cursors.current[targetPage] = docs[docs.length - 1]
          setArtists(docs.map((d) => ({ id: d.id, ...d.data() }) as Artist))
          setHasMore(snap.docs.length > PAGE_SIZE)
          setPage(targetPage)
          setLoading(false)
          shown.current = generationId
        },
        // Page 0 is the first paint, so it is worth serving from cache. Later pages hang
        // off a cursor taken from the previous page's server result — read those from the
        // server too rather than paginating over a mix of sources.
        { serverOnly: targetPage > 0 },
      ).catch(() => {
        if (id === request.current) {
          setError(true)
          setLoading(false)
        }
      })
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
    error,
    page,
    hasMore,
    nextPage: () => load(page + 1),
    prevPage: () => load(Math.max(0, page - 1)),
  }
}
