import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { joinFandom } from '../lib/callables'

export function JoinFandomButton({ artist }: { artist: Artist }) {
  const { user, signInWithGoogle } = useAuth()
  const { profile } = useUserProfile()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    return onSnapshot(doc(db, 'fandomStats', artist.id), (snap) => {
      setMemberCount((snap.data()?.memberCount as number | undefined) ?? 0)
    })
  }, [artist.id])

  if (!artist.fandomName) return null

  const joined = profile?.biasArtistId === artist.id

  const toggle = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    setPending(true)
    try {
      await joinFandom({ artistId: joined ? null : artist.id })
    } catch {
      // no-op — the live count/profile snapshot reflects the true state
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          joined
            ? 'border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
            : 'btn-gradient'
        }`}
      >
        {joined ? '✓ In this fandom' : `Join ${artist.fandomName}`}
      </button>
      {memberCount !== null && memberCount > 0 && (
        <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {memberCount.toLocaleString()} {memberCount === 1 ? 'member' : 'members'}
        </span>
      )}
    </div>
  )
}
