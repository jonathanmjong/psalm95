import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBattle } from '../hooks/useBattle'
import { useArtistIndex } from '../hooks/useArtistIndex'
import { useAuth } from '../contexts/AuthContext'
import { voteBattle } from '../lib/callables'

const REGION_LABEL: Record<'KR' | 'CN' | 'JP', string> = { KR: 'K-pop', CN: 'C-pop', JP: 'J-pop' }

export function BattleCard() {
  const { battle, loading, votedChoice, setVotedChoice } = useBattle()
  const { artists } = useArtistIndex()
  const { user, signInWithGoogle } = useAuth()
  const [pending, setPending] = useState<string | null>(null)

  if (loading || !battle) return null

  const fandomOf = (id: string) => artists.find((a) => a.id === id)?.fandomName ?? null

  const decided = votedChoice !== null
  const total = battle.aVotes + battle.bVotes
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

  const cast = async (choiceArtistId: string) => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    if (decided || pending) return
    setPending(choiceArtistId)
    try {
      await voteBattle({ choiceArtistId })
      setVotedChoice(choiceArtistId)
    } catch {
      // already voted / offline — the live snapshot keeps counts correct
    } finally {
      setPending(null)
    }
  }

  const Side = ({
    id,
    name,
    region,
    votes,
    align,
  }: {
    id: string
    name: string
    region: 'KR' | 'CN' | 'JP'
    votes: number
    align: 'left' | 'right'
  }) => {
    const chosen = votedChoice === id
    const fandom = fandomOf(id)
    return (
      <button
        onClick={() => cast(id)}
        disabled={decided || pending !== null}
        className={`flex-1 rounded-xl border p-4 transition disabled:cursor-default ${
          align === 'left' ? 'text-left' : 'text-right'
        } ${
          chosen
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-hairline)] enabled:hover:-translate-y-0.5 dark:border-[var(--color-hairline-dark)]'
        }`}
      >
        <div className="font-bold">{name}</div>
        <div className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {fandom ? `${fandom} · ${REGION_LABEL[region]}` : REGION_LABEL[region]}
        </div>
        {decided && (
          <>
            <div className="mt-2 text-lg font-extrabold tabular-nums">{pct(votes)}%</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]">
              <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct(votes)}%` }} />
            </div>
          </>
        )}
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">⚔️ Fandom face-off</h2>
        <span className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {decided ? `${total.toLocaleString()} votes` : user ? 'Pick your fandom' : 'Sign in to pick a side'}
        </span>
      </div>
      <div className="flex items-stretch gap-3">
        <Side id={battle.aArtistId} name={battle.aName} region={battle.aRegion} votes={battle.aVotes} align="left" />
        <div className="flex items-center text-sm font-extrabold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          VS
        </div>
        <Side id={battle.bArtistId} name={battle.bName} region={battle.bRegion} votes={battle.bVotes} align="right" />
      </div>
      {decided && (
        <p className="mt-3 text-center text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          You picked{' '}
          <Link
            to={`/artist/${votedChoice}`}
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {votedChoice === battle.aArtistId ? battle.aName : battle.bName}
          </Link>
          . New matchup every Monday.
        </p>
      )}
    </section>
  )
}
