import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface Comment {
  id: string
  uid: string
  displayName: string | null
  photoURL: string | null
  text: string
  createdAt: Timestamp | null
}

export function useComments(artistId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'artists', artistId, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(100),
    )
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment))
      setLoading(false)
    })
  }, [artistId])

  return { comments, loading }
}
