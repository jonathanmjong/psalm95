import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Artist } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { joinFandom } from '../lib/callables'
import { plural } from '../lib/plural'

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

  const joined = profile?.biasArtistId === artist.id
  // A missing fandom name must never take the join CTA off the page — joining is the whole
  // point of an artist page. Fall back to the artist's own name until the name is backfilled
  // (see scripts/fix-fandom-names.mjs).
  const joinLabel = artist.fandomName ? `Join ${artist.fandomName}` : `Join ${artist.name}’s fandom`

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
        className={`inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          joined
            ? 'border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
            : 'btn-gradient'
        }`}
      >
        {joined ? '✓ In this fandom' : joinLabel}
      </button>
      {/* Hiding the count at 0 hid it everywhere: no fandom has members yet, so this line —
          the only social proof on the page — never appeared at all. An empty fandom is an
          invitation, not something to suppress. */}
      {memberCount !== null && (
        <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {memberCount > 0
            ? plural(memberCount, 'member')
            : joined
              ? 'You’re the first member'
              : 'No members yet — be the first'}
        </span>
      )}
    </div>
  )
}
