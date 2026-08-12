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

function rawValue(artist: Artist, key: (typeof SEGMENTS)[number]['key']): number {
  if (key === 'weeklyVotes') return artist.weeklyVotes
  if (key === 'monthlyVotes') return artist.monthlyVotes
  return artist.metrics[key].value
}

/** Compact equal-weight segmented bar (⅓ per factor). Each segment's fill width reflects that
 * factor's 0-100 normalized value; segment identity is color + (via title attr / legend)
 * text, never color alone. */
export function ScoreBreakdown({ artist }: { artist: Artist }) {
  return (
    <div className="flex h-2 w-full gap-0.5" role="img" aria-label="Composite score breakdown">
      {SEGMENTS.map((seg) => {
        const value = Math.max(0, Math.min(100, rawValue(artist, seg.key)))
        return (
          <div
            key={seg.key}
            title={`${seg.label}: ${value.toFixed(0)}/100 (33% weight)`}
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
