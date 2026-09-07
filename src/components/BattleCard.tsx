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

  // A plain render function, not a component defined in the render body: as a component its
  // type identity changed every render, so React unmounted and remounted both halves of the
  // battle on every live snapshot and on every pending-state change.
  const renderSide = ({
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
      // The vote button was the only thing here, so signed out the sole outcome of touching
      // the face-off was a Google redirect — you couldn't even look at who was competing.
      // The profile link sits outside the button (a link nested in a button is invalid HTML
      // and would swallow the vote), and stays visibly secondary to it.
      <div className={`flex flex-1 flex-col ${align === 'left' ? 'items-start' : 'items-end'}`}>
        <button
          onClick={() => cast(id)}
          disabled={decided || pending !== null}
          className={`w-full flex-1 rounded-xl border p-4 transition disabled:cursor-default ${
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
        <Link
          to={`/artist/${id}`}
          aria-label={`View ${name}’s profile`}
          className="mt-1 inline-flex min-h-8 items-center px-1 text-xs text-[var(--color-ink-soft)] underline underline-offset-2 transition hover:text-[var(--color-accent)] dark:text-[var(--color-ink-soft-dark)]"
        >
          View profile
        </Link>
      </div>
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
      {/* Stacks below ~240px: two side-by-side columns plus the VS divider cannot fit at 200%
          zoom on a phone, and they used to push the page into horizontal scroll. */}
      <div className="flex flex-col items-stretch gap-3 min-[240px]:flex-row">
        {renderSide({ id: battle.aArtistId, name: battle.aName, region: battle.aRegion, votes: battle.aVotes, align: 'left' })}
        <div className="flex items-center text-sm font-extrabold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          VS
        </div>
        {renderSide({ id: battle.bArtistId, name: battle.bName, region: battle.bRegion, votes: battle.bVotes, align: 'right' })}
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
