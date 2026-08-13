import { useEffect, useState } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrDoc } from '../lib/swr'
import type { GenerationConfig } from '../types'

export function useGenerations() {
  const [generations, setGenerations] = useState<GenerationConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    swrDoc(
      doc(db, 'config/generations'),
      (snap) => (snap.data()?.list as GenerationConfig[]) ?? [],
      (list) => {
        if (!active) return
        setGenerations(list)
        setLoading(false)
      },
    ).catch(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return { generations, loading }
}
