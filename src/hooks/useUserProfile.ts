import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export interface UserProfile {
  displayName: string | null
  photoURL: string | null
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  /** KST day id of the last claimed daily heart, or null if never claimed. */
  lastHeartDate: string | null
  totalVotes: number
  activeUploadCount: number
  referralCount: number
  biasArtistId: string | null
  /** Claimed public handle, or undefined while the account has no public page at all. */
  handle?: string
  weeklyArtistVotes: Record<string, string[]>
  /** Per-type email opt-outs. A missing map or key means opted in — see `EmailPrefs`. */
  emailPrefs: EmailPrefs
  uid: string
}

/** Mirrors `wantsEmail` in functions/src/email/send.ts: absent means on, only an explicit
 * `false` turns an email off, so existing users keep receiving reminders. */
export interface EmailPrefs {
  streakReminders: boolean
  weeklyReset: boolean
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
        uid: user.uid,
        displayName: d.displayName ?? user.displayName,
        photoURL: d.photoURL ?? user.photoURL,
        currentStreak: d.currentStreak ?? 0,
        longestStreak: d.longestStreak ?? 0,
        streakFreezes: d.streakFreezes ?? 0,
        lastHeartDate: d.lastHeartDate ?? null,
        totalVotes: d.totalVotes ?? 0,
        activeUploadCount: d.activeUploadCount ?? 0,
        referralCount: d.referralCount ?? 0,
        biasArtistId: d.biasArtistId ?? null,
        handle: d.handle ?? undefined,
        weeklyArtistVotes: d.weeklyArtistVotes ?? {},
        emailPrefs: {
          streakReminders: d.emailPrefs?.streakReminders !== false,
          weeklyReset: d.emailPrefs?.weeklyReset !== false,
        },
      })
      setLoading(false)
    })
  }, [user])

  return { profile, loading }
}
