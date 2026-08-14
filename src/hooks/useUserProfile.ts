import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { User } from 'firebase/auth'
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

interface Snapshot {
  profile: UserProfile | null
  loading: boolean
}

type SnapshotListener = (snapshot: Snapshot) => void

interface Entry {
  snapshot: Snapshot
  listeners: Set<SnapshotListener>
  stop: () => void
}

/**
 * One Firestore listener per signed-in user, shared by every `useUserProfile()` caller.
 * The profile doc is read by the header, the daily heart, the fandom card *and* by every
 * artist row on the board, so a listener per hook instance would mean a dozen redundant
 * subscriptions to the same document. The listener is torn down when the last consumer
 * unmounts.
 */
const cache = new Map<string, Entry>()

function subscribe(user: User, listener: SnapshotListener): () => void {
  let entry = cache.get(user.uid)
  if (!entry) {
    const created: Entry = {
      snapshot: { profile: null, loading: true },
      listeners: new Set(),
      stop: () => {},
    }
    created.stop = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const d = snap.data() ?? {}
      created.snapshot = {
        loading: false,
        profile: {
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
        },
      }
      created.listeners.forEach((l) => l(created.snapshot))
    })
    cache.set(user.uid, created)
    entry = created
  }
  const current = entry
  current.listeners.add(listener)
  listener(current.snapshot)
  return () => {
    current.listeners.delete(listener)
    if (current.listeners.size === 0) {
      current.stop()
      cache.delete(user.uid)
    }
  }
}

/** Live subscription to the signed-in user's profile doc (streak, votes, uploads). */
export function useUserProfile() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState<Snapshot>({ profile: null, loading: true })

  useEffect(() => {
    if (!user) {
      setSnapshot({ profile: null, loading: false })
      return
    }
    return subscribe(user, setSnapshot)
  }, [user])

  return snapshot
}
