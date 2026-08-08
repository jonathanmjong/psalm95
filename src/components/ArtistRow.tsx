import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Artist } from '../types'
import { useTopPictures } from '../hooks/useTopPictures'
import { useAuth } from '../contexts/AuthContext'
import { ScoreBreakdown } from './ScoreBreakdown'
import { ArtistMiniGraph } from './ArtistMiniGraph'
import { castArtistVote } from '../lib/callables'

const REGION_LABEL: Record<Artist['region'], string> = {
  KR: 'K-pop',
  CN: 'C-pop',
  JP: 'J-pop',
}

export function ArtistRow({ artist, rank }: { artist: Artist; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { pictures } = useTopPictures(artist.id)
  const { user, signInWithGoogle } = useAuth()
  const [voteState, setVoteState] = useState<'idle' | 'voting' | 'voted' | 'error'>('idle')
  const [voteMessage, setVoteMessage] = useState<string | null>(null)

  const handleVote = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    setVoteState('voting')
    setVoteMessage(null)
    try {
      const result = await castArtistVote({ artistId: artist.id })
      setVoteState('voted')
      const streak = result.data.currentStreak
      const streakMsg = streak > 1 ? ` · 🔥 ${streak}-day streak!` : ''
      setVoteMessage(`Vote cast — ${result.data.weeklyVotesRemaining} left this week.${streakMsg}`)
    } catch (err) {
      setVoteState('error')
      setVoteMessage(err instanceof Error ? err.message : 'Could not cast vote.')
    }
  }

  return (
    <div
      className={`relative rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] transition-shadow duration-200 hover:shadow-md dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)] ${
        hovered ? 'z-40' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover graphic: popularity ranking trend (desktop only; mobile users expand the row).
          The hovered row is lifted to z-40 so this popover sits above the rows below it. */}
      {!expanded && hovered && (
        <div className="pointer-events-none absolute right-3 top-full z-40 mt-1 hidden md:block">
          <ArtistMiniGraph artist={artist} />
        </div>
      )}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
      >
        <span
          className={`w-8 shrink-0 text-center tabular-nums ${
            rank === 1
              ? 'text-xl font-extrabold text-yellow-400'
              : rank === 2
                ? 'text-xl font-extrabold text-slate-400'
                : rank === 3
                  ? 'text-xl font-extrabold text-amber-600'
                  : 'text-lg font-semibold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
          }`}
        >
          {rank}
        </span>
        {pictures[0] ? (
          <img
            src={pictures[0].url}
            alt={artist.name}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{artist.name}</span>
            <span className="shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-xs text-[var(--color-ink-soft)] dark:bg-[var(--color-surface-sunken-dark)] dark:text-[var(--color-ink-soft-dark)]">
              {REGION_LABEL[artist.region]}
            </span>
          </div>
          <div className="mt-1.5 max-w-xs">
            <ScoreBreakdown artist={artist} />
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          {pictures.slice(0, 5).map((pic) => (
            <img
              key={pic.id}
              src={pic.url}
              alt={`${artist.name} photo`}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ))}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[var(--color-hairline)] px-4 py-4 dark:border-[var(--color-hairline-dark)]">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              Members
            </h3>
            <p className="text-sm">{artist.members.map((m) => m.name).join(', ')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="group/vote relative">
              <button
                onClick={handleVote}
                disabled={voteState === 'voting'}
                className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold"
              >
                {user ? 'Vote for this week' : 'Sign in to vote'}
              </button>
              {/* Hover explainer: how artist voting works */}
              <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-60 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 text-left text-xs leading-snug shadow-lg group-hover/vote:block dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
                <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  How artist voting works
                </p>
                <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  Vote for up to 3 different artists each week. Each vote counts toward their weekly, monthly
                  and yearly totals and pushes them up the board. Sign in with Google to vote.
                </p>
              </div>
            </div>
            <Link
              to={`/artist/${artist.id}`}
              className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
            >
              View & upload pictures
            </Link>
            {voteMessage && (
              <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                {voteMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
