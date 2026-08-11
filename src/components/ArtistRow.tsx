import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Artist } from '../types'
import { useTopPictures } from '../hooks/useTopPictures'
import { useAuth } from '../contexts/AuthContext'
import { ScoreBreakdown } from './ScoreBreakdown'
import { ArtistMiniGraph } from './ArtistMiniGraph'
import { RowPicturesPanel } from './RowPicturesPanel'
import { castArtistVote } from '../lib/callables'
import { celebrateStreak } from '../lib/streak'

const REGION_LABEL: Record<Artist['region'], string> = {
  KR: 'K-pop',
  CN: 'C-pop',
  JP: 'J-pop',
}

interface Props {
  artist: Artist
  rank: number
  /** Controlled pictures-panel state, so only one row's panel is open at a time.
   *  Omit both props and the row manages the panel on its own. */
  picturesOpen?: boolean
  onPicturesToggle?: (open: boolean) => void
}

export function ArtistRow({ artist, rank, picturesOpen, onPicturesToggle }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [localPicturesOpen, setLocalPicturesOpen] = useState(false)
  /** True once the pictures panel has been opened at least once. The panel — and the
   *  Firestore read inside it — is mounted only from then on, so the 12 rows on a Home
   *  page cost nothing extra until someone actually asks for pictures. */
  const [picturesMounted, setPicturesMounted] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const { pictures } = useTopPictures(artist.id)
  const { user, signInWithGoogle } = useAuth()
  const [voteState, setVoteState] = useState<'idle' | 'voting' | 'voted' | 'error'>('idle')
  const [voteMessage, setVoteMessage] = useState<string | null>(null)
  /** Votes cast from this row in this session — applied locally so the raw weekly-votes
   * figure responds immediately. The composite score and rank are recomputed hourly and
   * are deliberately left untouched. */
  const [localVotes, setLocalVotes] = useState(0)
  /** Non-zero while a "+1" receipt is floating off the vote button; the value doubles as
   * the animation's restart key so rapid votes each get their own float. */
  const [floatId, setFloatId] = useState(0)

  useEffect(() => {
    if (!floatId) return
    const t = setTimeout(() => setFloatId(0), 1000)
    return () => clearTimeout(t)
  }, [floatId])

  const picsOpen = picturesOpen ?? localPicturesOpen

  const setPicsOpen = (open: boolean) => {
    if (open) setPicturesMounted(true)
    setLocalPicturesOpen(open)
    onPicturesToggle?.(open)
  }

  // Collapsing the row also puts the pictures panel away, so reopening the row does not
  // spring back to a panel the user thought they had closed.
  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    if (!next && picsOpen) setPicsOpen(false)
  }

  // Only the raw weekly-votes input to the breakdown moves optimistically; every other
  // segment is a periodically-refreshed metric.
  const shownArtist = useMemo(
    () => (localVotes === 0 ? artist : { ...artist, weeklyVotes: artist.weeklyVotes + localVotes }),
    [artist, localVotes],
  )

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
      setLocalVotes((n) => n + 1)
      setFloatId(Date.now())
      const streak = result.data.currentStreak
      const streakMsg = streak > 1 ? ` · 🔥 ${streak}-day streak!` : ''
      setVoteMessage(`Vote cast — ${result.data.weeklyVotesRemaining} left this week.${streakMsg}`)
      celebrateStreak(result.data)
    } catch (err) {
      setVoteState('error')
      setVoteMessage(err instanceof Error ? err.message : 'Could not cast vote.')
    }
  }

  return (
    <div
      className="relative rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] transition-shadow duration-200 hover:shadow-md dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setCursor(null)}
    >
      {/* Popularity ranking trend that follows the cursor (desktop only; mobile users expand
          the row). position:fixed + high z keeps it above everything, instantly. */}
      {!expanded && cursor && (
        <div
          className="pointer-events-none fixed z-50 hidden md:block"
          style={{
            left: Math.min(cursor.x + 18, window.innerWidth - 252),
            top: Math.min(cursor.y + 18, window.innerHeight - 168),
          }}
        >
          <ArtistMiniGraph artist={artist} />
        </div>
      )}
      <button
        onClick={toggleExpanded}
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
            <ScoreBreakdown artist={shownArtist} />
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
              {floatId > 0 && (
                <span
                  key={floatId}
                  aria-hidden
                  className="vote-float pointer-events-none absolute bottom-full left-1/2 z-20 -translate-x-1/2 text-sm font-extrabold text-[var(--color-accent)]"
                >
                  +1
                </span>
              )}
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
            <button
              type="button"
              onClick={() => setPicsOpen(!picsOpen)}
              aria-expanded={picsOpen}
              aria-controls={`pictures-panel-${artist.id}`}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:text-[var(--color-ink-soft-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
            >
              📷 Pictures
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 ${picsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <Link
              to={`/artist/${artist.id}`}
              className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
            >
              Open artist page
            </Link>
            {voteMessage && (
              <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                {voteMessage}
              </span>
            )}
          </div>

          {/* Mounted on first expand and kept mounted afterwards (just hidden), so
              reopening the panel never costs a second read. */}
          {picturesMounted && (
            <div id={`pictures-panel-${artist.id}`} hidden={!picsOpen}>
              <RowPicturesPanel artist={artist} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
