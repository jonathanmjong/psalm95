import { useState } from 'react'
import { useRankingHistory } from '../hooks/useRankingHistory'

const RANGES = [
  { label: 'Week', days: 7 },
  { label: 'Month', days: 30 },
  { label: 'Year', days: 365 },
] as const

const WIDTH = 640
const HEIGHT = 200
const PADDING = { top: 12, right: 12, bottom: 24, left: 12 }

export function RankingTrend({ artistId }: { artistId: string }) {
  const [rangeIdx, setRangeIdx] = useState(0)
  const { snapshots, loading } = useRankingHistory(artistId, RANGES[rangeIdx].days)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const values = snapshots.map((s) => s.compositeScore)
  const min = values.length ? Math.min(...values, 0) : 0
  const max = values.length ? Math.max(...values, 1) : 1
  const scaleY = (v: number) => PADDING.top + plotHeight - ((v - min) / (max - min || 1)) * plotHeight
  const scaleX = (i: number) =>
    PADDING.left + (snapshots.length > 1 ? (i / (snapshots.length - 1)) * plotWidth : plotWidth / 2)

  const linePath = snapshots
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(s.compositeScore)}`)
    .join(' ')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ranking score over time</h2>
        <div className="inline-flex rounded-full border border-[var(--color-hairline)] p-0.5 text-sm dark:border-[var(--color-hairline-dark)]">
          {RANGES.map((range, i) => (
            <button
              key={range.label}
              onClick={() => setRangeIdx(i)}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                i === rangeIdx
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading trend…
        </p>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No history yet — check back after the first daily snapshot runs.
        </p>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Ranking score trend">
          <line
            x1={PADDING.left}
            y1={HEIGHT - PADDING.bottom}
            x2={WIDTH - PADDING.right}
            y2={HEIGHT - PADDING.bottom}
            stroke="var(--color-hairline)"
            strokeWidth={1}
          />
          <path d={linePath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {snapshots.map((s, i) => (
            <circle key={s.date} cx={scaleX(i)} cy={scaleY(s.compositeScore)} r={4} fill="var(--series-1)" stroke="var(--color-surface)" strokeWidth={2}>
              <title>{`${s.date}: ${s.compositeScore.toFixed(1)}`}</title>
            </circle>
          ))}
          <text x={PADDING.left} y={HEIGHT - 6} fontSize={11} fill="var(--color-ink-soft)">
            {snapshots[0]?.date}
          </text>
          <text x={WIDTH - PADDING.right} y={HEIGHT - 6} fontSize={11} fill="var(--color-ink-soft)" textAnchor="end">
            {snapshots[snapshots.length - 1]?.date}
          </text>
        </svg>
      )}
    </div>
  )
}
