import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAllArtists } from '../hooks/useAllArtists'
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
  const { artists } = useAllArtists()

  usePageMeta({
    title: 'Fandom Hall of Fame | PsalmTune',
    description: 'Every weekly champion fandom — and their win streaks — crowned by fan votes, week by week.',
    path: '/hall-of-fame',
  })

  useEffect(() => {
    getDocs(query(collection(db, 'hallOfFame'), orderBy('weekId', 'desc'), limit(100)))
      .then((snap) => setWinners(snap.docs.map((d) => d.data() as Winner)))
      .finally(() => setLoading(false))
  }, [])

  const fandomOf = (id: string) => artists.find((a) => a.id === id)?.fandomName ?? null

  // Reigning champion's current streak — consecutive most-recent weeks held by the same artist.
  const currentStreak = useMemo(() => {
    if (winners.length === 0) return 0
    const top = winners[0].artistId
    let n = 0
    for (const w of winners) {
      if (w.artistId === top) n++
      else break
    }
    return n
  }, [winners])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-gradient text-4xl font-extrabold tracking-tight">🏆 Fandom Hall of Fame</h1>
        <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Every week’s champion fandom, crowned by fan votes. New champions are decided every Monday.
        </p>
      </header>

      {!loading && winners.length > 0 && currentStreak > 1 && (
        <div className="btn-gradient rounded-2xl px-5 py-4 font-semibold">
          🔥 {fandomOf(winners[0].artistId) ?? winners[0].artistName} is on a {currentStreak}-week win streak —
          who’s going to dethrone them?
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading champions…
        </p>
      ) : winners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-hairline)] py-14 text-center dark:border-[var(--color-hairline-dark)]">
          <p className="text-lg font-semibold">No champions yet 👑</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            The first champion fandom is crowned this coming Monday. Vote now to put your bias on top.
          </p>
          <Link to="/" className="btn-gradient mt-4 inline-block rounded-full px-5 py-2 text-sm font-semibold">
            Go vote
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {winners.map((w, i) => {
            const fandom = fandomOf(w.artistId)
            const reigning = i === 0 && currentStreak > 1
            return (
              <Link
                key={w.weekId}
                to={`/artist/${w.artistId}`}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 transition duration-200 hover:shadow-md dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
              >
                <span className="text-2xl">👑</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{fandom ?? w.artistName}</span>
                    {reigning && (
                      <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        🔥 {currentStreak}-WEEK STREAK
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                    {fandom ? `${w.artistName} · ` : ''}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
