import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { GenerationConfig } from '../types'

export function useGenerations() {
  const [generations, setGenerations] = useState<GenerationConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'config/generations'))
      .then((snap) => {
        setGenerations((snap.data()?.list as GenerationConfig[]) ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  return { generations, loading }
}
