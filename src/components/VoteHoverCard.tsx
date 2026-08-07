import type { Artist } from '../types'

const ROWS = [
  { label: 'Weekly', key: 'weeklyVotes', cssVar: 'var(--series-4)' },
  { label: 'Monthly', key: 'monthlyVotes', cssVar: 'var(--series-5)' },
  { label: 'Yearly', key: 'yearlyVotes', cssVar: 'var(--series-1)' },
] as const

/** Compact hover graphic showing an artist's fan votes across the three rolling windows. */
export function VoteHoverCard({ artist }: { artist: Artist }) {
  const values = ROWS.map((r) => (artist[r.key] as number) ?? 0)
  const max = Math.max(1, ...values)

  return (
    <div className="w-56 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 shadow-lg dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <p className="mb-2 text-xs font-semibold">Fan votes</p>
      <div className="space-y-2">
        {ROWS.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                {r.label}
              </span>
              <span className="font-medium tabular-nums">{values[i].toLocaleString()}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(values[i] / max) * 100}%`, backgroundColor: r.cssVar }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Weekly resets each Monday, monthly on the 1st, yearly on Jan 1.
      </p>
    </div>
  )
}
