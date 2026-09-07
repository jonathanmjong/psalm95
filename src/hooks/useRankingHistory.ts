import { useEffect, useState } from 'react'
import { collection, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'
import type { RankingSnapshot } from '../types'

// Cache per artist+range so repeat hovers (and revisits) are instant instead of refetching.
const cache = new Map<string, RankingSnapshot[]>()

export function useRankingHistory(artistId: string, days: number) {
  const key = `${artistId}:${days}`
  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>(() => cache.get(key) ?? [])
  const [loading, setLoading] = useState(() => !cache.has(key))

  useEffect(() => {
    const k = `${artistId}:${days}`
    const cached = cache.get(k)
    if (cached) {
      setSnapshots(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'artists', artistId, 'rankingHistory'), orderBy('date', 'desc'), limit(days))
    let active = true
    // History is append-only and only rewritten by the nightly job, so the local cache is a
    // safe first paint for the hover graph; the server read still lands right behind it.
    swrQuery(
      q,
      (snap) => snap.docs.map((d) => d.data() as RankingSnapshot).reverse(),
      (docs) => {
        cache.set(k, docs)
        if (!active) return
        setSnapshots(docs)
        setLoading(false)
      },
    ).catch(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [artistId, days])

  return { snapshots, loading }
}
