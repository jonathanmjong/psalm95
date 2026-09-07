import type { Artist } from '../types'

// Categorical slots from the dataviz reference palette, fixed order —
// never reassigned/cycled per segment.
const SEGMENTS: {
  key: 'popularity' | 'weeklyVotes' | 'monthlyVotes'
  label: string
  cssVar: string
}[] = [
  { key: 'popularity', label: 'Online popularity', cssVar: 'var(--series-1)' },
  { key: 'weeklyVotes', label: 'Weekly votes', cssVar: 'var(--series-4)' },
  { key: 'monthlyVotes', label: 'Monthly votes', cssVar: 'var(--series-5)' },
]

export const SCORE_LEGEND = SEGMENTS.map(({ label, cssVar }) => ({ label, cssVar }))

/** Points one not-yet-recounted vote is worth when there is no raw vote total to scale
 * from — small, but enough that a fresh vote visibly lands. */
const MIN_PENDING_NUDGE = 2

function rawValue(artist: Artist, key: (typeof SEGMENTS)[number]['key']): number {
  if (key === 'weeklyVotes') return artist.weeklyVotes
  if (key === 'monthlyVotes') return artist.monthlyVotes
  return artist.metrics[key].value
}

/** 3.8M / 12.4K / 947 — the raw figure is secondary context in the tooltip, never the bar. */
function compact(n: number): string {
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '')
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 1_000) return `${trim(n / 1_000)}K`
  return Math.round(n).toLocaleString()
}

/** A vote lands instantly but the roster-wide normalization only reruns hourly, so the stored
 * factor cannot move yet. One vote is worth roughly `factor / raw` points on that min-max
 * scale (the roster's weekly-vote minimum is 0), which keeps the optimistic nudge honest;
 * with no raw votes to scale from it falls back to a small fixed nudge. */
function withPendingVotes(factor: number, raw: number, pending: number): number {
  if (pending <= 0) return factor
  const perVote = factor > 0 && raw > 0 ? factor / raw : MIN_PENDING_NUDGE
  return Math.min(100, factor + perVote * pending)
}

interface Props {
  artist: Artist
  /** Votes cast locally but not yet folded into `artist.factors` by the hourly recount.
   * Nudges the weekly segment so a fresh vote doesn't look ignored. */
  pendingVotes?: number
}

/** Compact equal-weight segmented bar (⅓ per factor). Each segment's fill width is that
 * factor's 0-100 normalized score — the same number the composite score is built from, so the
 * bar and the ranking can't disagree. Segment identity is color + (via title attr / legend)
 * text, never color alone. */
export function ScoreBreakdown({ artist, pendingVotes = 0 }: Props) {
  return (
    <div className="flex h-2 w-full gap-0.5" role="img" aria-label="Composite score breakdown">
      {SEGMENTS.map((seg) => {
        const pending = seg.key === 'weeklyVotes' ? pendingVotes : 0
        const raw = rawValue(artist, seg.key)
        const factor = artist.factors?.[seg.key]
        // Docs written before recomputeRankings started denormalizing `factors` have nothing
        // to normalize against — fall back to the old raw-clamped rendering until the next
        // hourly run fills them in.
        const value =
          factor === undefined
            ? Math.max(0, Math.min(100, raw + pending))
            : withPendingVotes(factor, raw, pending)
        const rawLabel = compact(raw + pending) + (pending > 0 ? ` (+${pending} pending)` : '')
        return (
          <div
            key={seg.key}
            title={`${seg.label}: ${value.toFixed(0)}/100 (⅓ weight) · ${rawLabel}`}
            className="h-full flex-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]"
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${value}%`, backgroundColor: seg.cssVar }}
            />
          </div>
        )
      })}
    </div>
  )
}
