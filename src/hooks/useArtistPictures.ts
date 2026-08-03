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
import type { ArtistPicture } from '../types'

const PAGE_SIZE = 12

export type PictureSort = 'date' | 'votes'

export function useArtistPictures(artistId: string, sort: PictureSort, memberId: string | null) {
  const [pictures, setPictures] = useState<ArtistPicture[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const cursors = useRef<QueryDocumentSnapshot[]>([])

  const load = useCallback(
    async (targetPage: number) => {
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
      const snap = await getDocs(q)
      const docs = snap.docs.slice(0, PAGE_SIZE)
      if (docs.length > 0) cursors.current[targetPage] = docs[docs.length - 1]
      setPictures(docs.map((d) => ({ id: d.id, ...d.data() }) as ArtistPicture))
      setHasMore(snap.docs.length > PAGE_SIZE)
      setPage(targetPage)
      setLoading(false)
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
    refresh: () => load(0),
  }
}
