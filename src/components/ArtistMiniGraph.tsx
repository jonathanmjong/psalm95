import { useRankingHistory } from '../hooks/useRankingHistory'
import type { Artist } from '../types'

const W = 220
const H = 64

/** Compact popularity/ranking sparkline shown when hovering an artist row.
 * Fetches the artist's ranking history lazily (only mounts on hover). */
export function ArtistMiniGraph({ artist }: { artist: Artist }) {
  const { snapshots, loading } = useRankingHistory(artist.id, 30)

  const values = snapshots.map((s) => s.compositeScore)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values, 1) : 1
  const x = (i: number) => (snapshots.length > 1 ? (i / (snapshots.length - 1)) * (W - 8) + 4 : W / 2)
  const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12)
  const path = snapshots.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(s.compositeScore)}`).join(' ')

  return (
    <div className="w-60 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 shadow-lg dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold">Popularity ranking</span>
        <span className="text-xs font-bold tabular-nums text-[var(--color-accent)]">#{artist.rank}</span>
      </div>
      {loading ? (
        <div className="flex h-16 items-center justify-center text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading…
        </div>
      ) : snapshots.length < 2 ? (
        <div className="flex h-16 flex-col items-center justify-center gap-0.5 text-center">
          <span className="text-lg font-extrabold tabular-nums">{artist.compositeScore.toFixed(1)}</span>
          <span className="text-[10px] text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            score · trend builds daily
          </span>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ranking score trend">
          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(snapshots.length - 1)} cy={y(values[values.length - 1])} r="3" fill="var(--series-1)" />
        </svg>
      )}
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        <span>score {artist.compositeScore.toFixed(1)}</span>
        <span>{artist.weeklyVotes.toLocaleString()} votes this week</span>
      </div>
    </div>
  )
}
