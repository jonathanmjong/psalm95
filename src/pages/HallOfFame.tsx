import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { usePageMeta } from '../hooks/usePageMeta'

interface Winner {
  weekId: string
  artistId: string
  artistName: string
  region: 'KR' | 'CN' | 'JP'
  votes: number
}

const REGION_LABEL: Record<Winner['region'], string> = { KR: 'K-pop', CN: 'C-pop', JP: 'J-pop' }

export function HallOfFame() {
  const [winners, setWinners] = useState<Winner[]>([])
  const [loading, setLoading] = useState(true)

  usePageMeta({
    title: 'Hall of Fame | PsalmTune',
    description: 'Every weekly #1 — the artists your votes crowned, week by week.',
    path: '/hall-of-fame',
  })

  useEffect(() => {
    getDocs(query(collection(db, 'hallOfFame'), orderBy('weekId', 'desc'), limit(100)))
      .then((snap) => setWinners(snap.docs.map((d) => d.data() as Winner)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-gradient text-4xl font-extrabold tracking-tight">🏆 Hall of Fame</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Every week’s #1, crowned by fan votes. New champions are decided every Monday.
        </p>
      </header>

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading champions…
        </p>
      ) : winners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-hairline)] py-14 text-center dark:border-[var(--color-hairline-dark)]">
          <p className="text-lg font-semibold">No champions yet 👑</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            The first winner is crowned this coming Monday. Vote now to put your bias on top.
          </p>
          <Link to="/" className="btn-gradient mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold">
            Go vote
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {winners.map((w) => (
            <Link
              key={w.weekId}
              to={`/artist/${w.artistId}`}
              className="lift flex items-center gap-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
            >
              <span className="text-2xl">👑</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{w.artistName}</div>
                <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  {REGION_LABEL[w.region]} · {w.weekId.replace('-W', ' · week ')}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold tabular-nums">{w.votes.toLocaleString()}</div>
                <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  votes
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
