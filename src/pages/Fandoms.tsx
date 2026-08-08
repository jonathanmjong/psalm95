import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAllArtists } from '../hooks/useAllArtists'
import { usePageMeta } from '../hooks/usePageMeta'
import type { Artist } from '../types'

const PERIODS = [
  { key: 'weeklyVotes', label: 'This week' },
  { key: 'monthlyVotes', label: 'This month' },
  { key: 'yearlyVotes', label: 'This year' },
] as const

export function Fandoms() {
  const { artists, loading } = useAllArtists()
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('weeklyVotes')

  usePageMeta({
    title: 'Fandom leaderboard | PsalmTune',
    description:
      'Which fandom is voting hardest? Ranked by fan votes this week, month, and year — ARMY, BLINK, ONCE, NEVERLAND and more.',
    path: '/fandoms',
  })

  const ranked = artists
    .filter((a) => a.fandomName)
    .map((a) => ({ artist: a, votes: (a[periodKey] as number) ?? 0 }))
    .sort((x, y) => y.votes - x.votes)

  const medal = (rank: number) =>
    rank === 1
      ? 'text-yellow-400'
      : rank === 2
        ? 'text-slate-400'
        : rank === 3
          ? 'text-amber-600'
          : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-gradient text-4xl font-extrabold tracking-tight">Fandom leaderboard</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Which fandom is voting hardest? Rally your fellow stans and out-vote them.
        </p>
      </header>

      <div className="inline-flex rounded-full border border-[var(--color-hairline)] p-0.5 text-sm dark:border-[var(--color-hairline-dark)]">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodKey(p.key)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              periodKey === p.key
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading fandoms…
        </p>
      ) : (
        <div className="space-y-2">
          {ranked.map(({ artist, votes }, i) => (
            <FandomRow key={artist.id} artist={artist} votes={votes} rank={i + 1} medalClass={medal(i + 1)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FandomRow({
  artist,
  votes,
  rank,
  medalClass,
}: {
  artist: Artist
  votes: number
  rank: number
  medalClass: string
}) {
  return (
    <Link
      to={`/artist/${artist.id}`}
      className="lift flex items-center gap-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
    >
      <span className={`w-7 shrink-0 text-center text-lg font-extrabold tabular-nums ${medalClass}`}>{rank}</span>
      {artist.fandomColorHex && (
        <span
          className="h-8 w-8 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: artist.fandomColorHex }}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{artist.fandomName}</div>
        <div className="truncate text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {artist.name}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-bold tabular-nums">{votes.toLocaleString()}</div>
        <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">votes</div>
      </div>
    </Link>
  )
}
