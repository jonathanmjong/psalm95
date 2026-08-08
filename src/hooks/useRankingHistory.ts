import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
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
    getDocs(q)
      .then((snap) => {
        const docs = snap.docs.map((d) => d.data() as RankingSnapshot).reverse()
        cache.set(k, docs)
        if (active) setSnapshots(docs)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [artistId, days])

  return { snapshots, loading }
}
