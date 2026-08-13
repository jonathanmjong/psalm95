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
import type { ArtistPicture } from '../types'

const PAGE_SIZE = 12

export type PictureSort = 'date' | 'votes'

export function useArtistPictures(artistId: string, sort: PictureSort, memberId: string | null) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const cursors = useRef<QueryDocumentSnapshot[]>([])
  /** Bumped per load so a superseded request's delivery can't write stale pictures. */
  const request = useRef(0)
  /** Which artist/sort/member combination is on screen, so a post-vote refresh keeps the
   * grid visible and only a genuine filter change blanks it. */
  const shown = useRef<string | null>(null)

  const load = useCallback(
    async (targetPage: number, serverOnly = false) => {
      const id = ++request.current
      const key = `${artistId}|${sort}|${memberId ?? ''}`
      if (shown.current !== key) {
        setPictures([])
        shown.current = null
      }
      setLoading(true)
      const orderField = sort === 'date' ? 'uploadedAt' : 'voteCount'
      const constraints = [
        ...(memberId ? [where('taggedMemberKeys', 'array-contains', `${artistId}_${memberId}`)] : []),
        orderBy(orderField, 'desc'),
      ]
      const cursor = targetPage > 0 ? cursors.current[targetPage - 1] : undefined
      const q = query(
        collection(db, 'artists', artistId, 'pictures'),
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
          setPictures(docs.map((d) => ({ id: d.id, ...d.data() }) as ArtistPicture))
          setHasMore(snap.docs.length > PAGE_SIZE)
          setPage(targetPage)
          setLoading(false)
          shown.current = key
        },
        // Cursor pages read from the server (see useArtists), and so does an explicit
        // refresh() after a vote/upload/delete — the cache still holds the old counts.
        { serverOnly: serverOnly || targetPage > 0 },
      ).catch(() => {
        if (id === request.current) setLoading(false)
      })
    },
    [artistId, sort, memberId],
  )

  useEffect(() => {
    cursors.current = []
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, sort, memberId])

  return {
    pictures,
    loading,
    page,
    hasMore,
    nextPage: () => load(page + 1),
    prevPage: () => load(Math.max(0, page - 1)),
    refresh: () => load(0, true),
  }
}
