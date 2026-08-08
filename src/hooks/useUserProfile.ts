import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export interface UserProfile {
  displayName: string | null
  photoURL: string | null
  currentStreak: number
  longestStreak: number
  totalVotes: number
  activeUploadCount: number
  weeklyArtistVotes: Record<string, string[]>
}

/** Live subscription to the signed-in user's profile doc (streak, votes, uploads). */
export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data() ?? {}
      setProfile({
        displayName: d.displayName ?? user.displayName,
        photoURL: d.photoURL ?? user.photoURL,
        currentStreak: d.currentStreak ?? 0,
        longestStreak: d.longestStreak ?? 0,
        totalVotes: d.totalVotes ?? 0,
        activeUploadCount: d.activeUploadCount ?? 0,
        weeklyArtistVotes: d.weeklyArtistVotes ?? {},
      })
      setLoading(false)
    })
  }, [user])

  return { profile, loading }
}
