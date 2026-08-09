import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

/** artistId → fandom member count, for the whole roster. */
export function useFandomStats(): Record<string, number> {
  const [stats, setStats] = useState<Record<string, number>>({})

  useEffect(() => {
    getDocs(collection(db, 'fandomStats')).then((snap) => {
      const map: Record<string, number> = {}
      snap.docs.forEach((d) => {
        map[d.id] = (d.data().memberCount as number | undefined) ?? 0
      })
      setStats(map)
    })
  }, [])

  return stats
}
