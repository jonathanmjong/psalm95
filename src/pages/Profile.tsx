import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile, type EmailPrefs } from '../hooks/useUserProfile'
import { usePageMeta } from '../hooks/usePageMeta'
import { db } from '../lib/firebase'
import { ACHIEVEMENTS } from '../lib/achievements'
import { currentWeekId, currentDayIdKST } from '../lib/dates'

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

const EMAIL_PREF_ROWS: { key: keyof EmailPrefs; label: string; description: string }[] = [
  {
    key: 'streakReminders',
    label: 'Streak reminders',
    description: 'An evening nudge when your streak is about to break (KST evening, only if you haven’t acted).',
  },
  {
    key: 'weeklyReset',
    label: 'Weekly reset reminder',
    description: 'Sunday heads-up when you still have unspent votes before the Monday reset.',
  },
]

function EmailPrefsCard({ uid, prefs }: { uid: string; prefs: EmailPrefs }) {
  const [error, setError] = useState<string | null>(null)

  // Written straight to the profile doc — `emailPrefs` isn't one of the callable-only fields
  // the security rules freeze. The live snapshot reflects the change immediately.
  const toggle = async (key: keyof EmailPrefs, value: boolean) => {
    setError(null)
    try {
      await setDoc(doc(db, 'users', uid), { emailPrefs: { ...prefs, [key]: value } }, { merge: true })
    } catch {
      setError('Couldn’t save that — please try again.')
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-hairline)] p-4 dark:border-[var(--color-hairline-dark)]">
      <h2 className="text-lg font-semibold">Email notifications</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Sent to the address on your Google account. Turn either off at any time.
      </p>
      <div className="mt-3 space-y-3">
        {EMAIL_PREF_ROWS.map(({ key, label, description }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => void toggle(key, e.currentTarget.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span>
              <span className="text-sm font-semibold">{label}</span>
              <span className="block text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
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
  const heartClaimedToday = profile.lastHeartDate === currentDayIdKST()

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
          <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Daily heart claimed today {heartClaimedToday ? '✓' : '✗'} · ❄️ {profile.streakFreezes} streak{' '}
            {profile.streakFreezes === 1 ? 'freeze' : 'freezes'}{' '}
            <span className="opacity-70">(earn one every 30 streak days — it covers a missed day)</span>
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

      <EmailPrefsCard uid={profile.uid} prefs={profile.emailPrefs} />

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
