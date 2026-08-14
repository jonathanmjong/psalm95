import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc, type Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { usePageMeta } from '../hooks/usePageMeta'
import { ShareButton } from '../components/ShareButton'
import { PUBLIC_ACHIEVEMENTS } from '../lib/achievements'

/**
 * The opt-in public page, rendered entirely from `profiles/{uid}` — a projection that only
 * exists once a handle has been claimed. It carries no display name, no email, no photo and
 * no per-artist vote history, so there is nothing here to leak: a handle and its stats.
 */
interface PublicProfileDoc {
  handle: string
  biasArtistId: string | null
  fandomName: string | null
  fandomColorHex: string | null
  currentStreak: number
  longestStreak: number
  totalVotes: number
  activeUploadCount: number
  joinedAt: Timestamp | null
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

export function PublicProfile() {
  const { handle: handleParam } = useParams<{ handle: string }>()
  const handle = (handleParam ?? '').toLowerCase()
  const [profile, setProfile] = useState<PublicProfileDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setProfile(null)

    // handles/{handle} → uid → profiles/{uid}. Both are world-readable by design.
    const load = async () => {
      const handleSnap = await getDoc(doc(db, 'handles', handle))
      const uid = handleSnap.data()?.uid as string | undefined
      const snap = uid ? await getDoc(doc(db, 'profiles', uid)) : null
      if (cancelled) return
      const d = snap?.data()
      setProfile(
        d
          ? {
              handle: d.handle ?? handle,
              biasArtistId: d.biasArtistId ?? null,
              fandomName: d.fandomName ?? null,
              fandomColorHex: d.fandomColorHex ?? null,
              currentStreak: d.currentStreak ?? 0,
              longestStreak: d.longestStreak ?? 0,
              totalVotes: d.totalVotes ?? 0,
              activeUploadCount: d.activeUploadCount ?? 0,
              joinedAt: d.joinedAt ?? null,
            }
          : null,
      )
      setLoading(false)
    }
    void load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [handle])

  usePageMeta({
    title: profile ? `@${profile.handle} on PsalmTune` : 'Fan profile | PsalmTune',
    description: profile
      ? `@${profile.handle}${profile.fandomName ? ` · ${profile.fandomName}` : ''} — ${profile.currentStreak}-day streak and ${profile.totalVotes} votes cast on PsalmTune.`
      : 'Fan profiles on PsalmTune — streaks, badges and fandoms.',
    path: `/u/${handle}`,
  })

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Loading profile…
      </p>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">No fan by that handle</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          @{handle} hasn’t claimed a public profile — or the link’s wrong.
        </p>
        <Link to="/" className="btn-gradient rounded-full px-6 py-2.5 font-semibold">
          Back to rankings
        </Link>
      </div>
    )
  }

  const joined = profile.joinedAt?.toDate?.()
  const joinedLabel = joined
    ? `Fan since ${joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
    : null

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-4">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-3xl font-extrabold uppercase text-white"
          style={{ backgroundImage: 'var(--gradient-brand)' }}
          aria-hidden
        >
          {profile.handle.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">@{profile.handle}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            {profile.fandomName && profile.biasArtistId && (
              <Link
                to={`/artist/${profile.biasArtistId}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-3 py-1 font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: profile.fandomColorHex ?? 'var(--color-accent)' }}
                  aria-hidden
                />
                {profile.fandomName}
              </Link>
            )}
            {joinedLabel && <span>{joinedLabel}</span>}
          </div>
        </div>
        {/* Brag-shaped, and every number in it is one the page itself is showing. */}
        <ShareButton
          title={`@${profile.handle} on PsalmTune`}
          copyMessage
          text={`@${profile.handle} on PsalmTune — 🔥 ${profile.currentStreak}-day streak, ${profile.totalVotes.toLocaleString()} votes for ${profile.fandomName ?? 'my faves'}.`}
          url={`https://psalmtune.com/u/${profile.handle}`}
        />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={`🔥 ${profile.currentStreak}`} label="Current streak" accent />
        <Stat value={profile.longestStreak} label="Longest streak" />
        <Stat value={profile.totalVotes} label="Total votes" />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Achievements</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PUBLIC_ACHIEVEMENTS.map((a) => {
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

      <p className="text-center text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Public fan profiles show a handle and stats only — never a real name or email.{' '}
        <Link to="/profile" className="underline">
          Claim your own handle
        </Link>
        .
      </p>
    </div>
  )
}
