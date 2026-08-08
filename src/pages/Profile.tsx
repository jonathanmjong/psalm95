import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { usePageMeta } from '../hooks/usePageMeta'
import { ACHIEVEMENTS } from '../lib/achievements'
import { currentWeekId } from '../lib/dates'

function InviteCard({ uid, referralCount }: { uid: string; referralCount: number }) {
  const [copied, setCopied] = useState(false)
  const link = `https://psalmtune.com/?ref=${uid}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked
    }
  }
  return (
    <section className="rounded-2xl border border-[var(--color-hairline)] p-4 dark:border-[var(--color-hairline-dark)]">
      <h2 className="text-lg font-semibold">Invite friends</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Grow your fandom’s voting power. You’ve invited{' '}
        <span className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {referralCount}
        </span>{' '}
        {referralCount === 1 ? 'friend' : 'friends'}.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-sunken)] px-4 py-2 text-sm dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-sunken-dark)]"
        />
        <button onClick={copy} className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold">
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </section>
  )
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] p-4 text-center dark:border-[var(--color-hairline-dark)]">
      <div className={`text-3xl font-extrabold tabular-nums ${accent ? 'text-gradient' : ''}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        {label}
      </div>
    </div>
  )
}

export function Profile() {
  const { user, signInWithGoogle } = useAuth()
  const { profile, loading } = useUserProfile()

  usePageMeta({ title: 'Your profile | PsalmTune', path: '/profile' })

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Sign in to track your voting streak, votes, and achievements.
        </p>
        <button onClick={() => signInWithGoogle()} className="btn-gradient rounded-full px-6 py-2.5 font-semibold">
          Sign in with Google
        </button>
      </div>
    )
  }

  if (loading || !profile) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Loading your profile…
      </p>
    )
  }

  const weekVotes = (profile.weeklyArtistVotes[currentWeekId()] ?? []).length

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        {profile.photoURL ? (
          <img src={profile.photoURL} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.displayName ?? 'Fan'}</h1>
          <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            {profile.currentStreak > 0
              ? `🔥 ${profile.currentStreak}-day voting streak — keep it alive!`
              : 'Vote today to start a streak 🔥'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={`🔥 ${profile.currentStreak}`} label="Current streak" accent />
        <Stat value={profile.longestStreak} label="Longest streak" />
        <Stat value={`${weekVotes}/3`} label="Votes this week" />
        <Stat value={profile.totalVotes} label="Total votes" />
      </div>

      <InviteCard uid={profile.uid} referralCount={profile.referralCount} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Achievements</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const earned = a.earned(profile)
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 text-center transition ${
                  earned
                    ? 'border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
                    : 'border-dashed border-[var(--color-hairline)] opacity-45 dark:border-[var(--color-hairline-dark)]'
                }`}
                title={a.description}
              >
                <div className={`text-3xl ${earned ? '' : 'grayscale'}`}>{a.emoji}</div>
                <div className="mt-2 text-sm font-semibold">{a.title}</div>
                <div className="mt-0.5 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  {a.description}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
