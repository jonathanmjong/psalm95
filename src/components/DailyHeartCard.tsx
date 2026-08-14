import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { useArtistIndex } from '../hooks/useArtistIndex'
import { claimDailyHeart } from '../lib/callables'
import { celebrateStreak } from '../lib/streak'
import { currentDayIdKST, msUntilKstMidnight, formatCountdown } from '../lib/dates'

function useKstCountdown() {
  const [ms, setMs] = useState(() => msUntilKstMidnight())
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilKstMidnight()), 30_000)
    return () => clearInterval(t)
  }, [])
  return ms
}

/** The daily ritual: one tap, one heart for your fandom, one more day on the streak.
 * Unclaimed hearts never accumulate — midnight KST takes them. */
export function DailyHeartCard() {
  const { user, signInWithGoogle } = useAuth()
  const { profile } = useUserProfile()
  const { artists } = useArtistIndex()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const resetMs = useKstCountdown()

  const bias = profile?.biasArtistId ? artists.find((a) => a.id === profile.biasArtistId) : null
  const fandomName = bias?.fandomName ?? bias?.name ?? 'your fandom'
  const claimedToday = profile?.lastHeartDate === currentDayIdKST()
  const streak = profile?.currentStreak ?? 0

  const claim = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await claimDailyHeart()
      celebrateStreak(result.data, { handle: profile?.handle })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim your heart.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">💗 Daily Heart</h2>
        <p className="mt-0.5 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {!user
            ? 'One free heart for your fandom, every day. Miss a day and it’s gone.'
            : !profile?.biasArtistId
              ? 'Pick a fandom and start claiming a heart for them every day.'
              : claimedToday
                ? `Claimed today ✓${streak > 0 ? ` · 🔥 ${streak}-day streak` : ''} · resets at midnight KST (in ${formatCountdown(resetMs)})`
                : `One tap adds a heart to ${fandomName}’s tally and keeps your streak alive. Resets at midnight KST (in ${formatCountdown(resetMs)}).`}
        </p>
        {error && <p className="mt-1 text-xs text-[var(--color-accent)]">{error}</p>}
      </div>

      {!user ? (
        <button
          onClick={() => signInWithGoogle()}
          className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
        >
          Sign in to claim 💗
        </button>
      ) : !profile?.biasArtistId ? (
        <Link
          to="/fandoms"
          className="min-h-10 rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
        >
          Join a fandom
        </Link>
      ) : claimedToday ? (
        <span className="shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-4 py-2 text-sm font-semibold dark:bg-[var(--color-surface-sunken-dark)]">
          Claimed today ✓
        </span>
      ) : (
        // The fandom name lives in the description line above, not in the label: names run
        // long ("A.R.M.Y (Adorable Representative M.C for Youth)") and a shrink-0 button
        // with a max-content label pushed the whole page into horizontal scroll on phones.
        <button
          onClick={claim}
          disabled={pending}
          className="btn-gradient min-h-10 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap"
        >
          {pending ? 'Claiming…' : 'Claim today’s heart '}
          {!pending && <span className="heartbeat inline-block">💗</span>}
        </button>
      )}
    </section>
  )
}
