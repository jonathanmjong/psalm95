import { useEffect, useState } from 'react'
import { collection } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'

export interface FandomStat {
  memberCount: number
  /** Daily hearts claimed by this fandom since the weekly reset — a separate, lighter
   * currency that never feeds the vote-based ranking. */
  weeklyHearts: number
}

/** artistId → fandom stats (member count, weekly hearts), for the whole roster. */
export function useFandomStats(): Record<string, FandomStat> {
  const [stats, setStats] = useState<Record<string, FandomStat>>({})

  useEffect(() => {
    let active = true
    swrQuery(
      collection(db, 'fandomStats'),
      (snap) => {
        const map: Record<string, FandomStat> = {}
        snap.docs.forEach((d) => {
          map[d.id] = {
            memberCount: (d.data().memberCount as number | undefined) ?? 0,
            weeklyHearts: (d.data().weeklyHearts as number | undefined) ?? 0,
          }
        })
        return map
      },
      (map) => {
        if (active) setStats(map)
      },
    ).catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return stats
}
