import { SCORE_LEGEND } from './ScoreBreakdown'

export function ScoreLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
      {SCORE_LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.cssVar }}
            aria-hidden
          />
          {item.label} · 20%
        </span>
      ))}
    </div>
  )
}
