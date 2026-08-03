import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { RankingSnapshot } from '../types'

export function useRankingHistory(artistId: string, days: number) {
  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = query(
      collection(db, 'artists', artistId, 'rankingHistory'),
      orderBy('date', 'desc'),
      limit(days),
    )
    getDocs(q)
      .then((snap) => {
        const docs = snap.docs.map((d) => d.data() as RankingSnapshot & { date: string })
        setSnapshots(docs.reverse())
      })
      .finally(() => setLoading(false))
  }, [artistId, days])

  return { snapshots, loading }
}
