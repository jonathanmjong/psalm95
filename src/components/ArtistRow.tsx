import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Artist } from '../types'
import { useTopPictures } from '../hooks/useTopPictures'
import { useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../contexts/AuthContext'
import { ScoreBreakdown } from './ScoreBreakdown'
import { ArtistMiniGraph } from './ArtistMiniGraph'
import { RowPicturesPanel } from './RowPicturesPanel'
import { ShareButton } from './ShareButton'
import { castArtistVote } from '../lib/callables'
import { celebrateStreak } from '../lib/streak'
import { sized, sizedSrcSet } from '../lib/images'

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
  // Thumbnails come from the hourly-denormalized topPictureUrls when present (zero reads);
  // the per-row pictures query only runs for docs that predate that field.
  const { pictures } = useTopPictures(artist.id, 5, 0, !artist.topPictureUrls)
  const thumbUrls = artist.topPictureUrls ?? pictures.map((p) => p.url)
  const { user, signInWithGoogle } = useAuth()
  // Shared listener (see useUserProfile) — a board full of rows costs one subscription.
  // Only used for the handle the streak brag links to.
  const { profile } = useUserProfile()
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

  // The rally a fresh vote is worth sharing. The rank claimed here is the artist's own
  // board rank — `artist.rank` as recomputed server-side, falling back to the position
  // this row is rendered at — never an invented fandom-board standing, which only the
  // live /fandoms race knows.
  const shareRank = artist.rank > 0 ? artist.rank : rank
  const rallyText = artist.fandomName
    ? `I just voted for ${artist.name} on PsalmTune 💜 They’re #${shareRank} on the board — ${artist.fandomName}, help us climb!`
    : `I just voted for ${artist.name} on PsalmTune — they’re #${shareRank}. Every vote moves the board.`

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
      celebrateStreak(result.data, { handle: profile?.handle })
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
      {/* The row header is a flex container, not one big <button>: the primary actions live
          here now, and interactive elements can't legally nest inside a button. The name /
          score region stays the expand toggle. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={toggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
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
          {thumbUrls[0] ? (
            <img
              src={sized(thumbUrls[0], 120)}
              srcSet={sizedSrcSet(thumbUrls[0], 120, 250)}
              sizes="48px"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              alt={artist.name}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{artist.name}</span>
              <span className="hidden shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-xs text-[var(--color-ink-soft)] sm:inline dark:bg-[var(--color-surface-sunken-dark)] dark:text-[var(--color-ink-soft-dark)]">
                {REGION_LABEL[artist.region]}
              </span>
            </div>
            <div className="mt-1.5 max-w-xs">
              <ScoreBreakdown artist={shownArtist} />
            </div>
          </div>
        </button>

        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {thumbUrls.slice(0, 4).map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={sized(url, 120)}
              srcSet={sizedSrcSet(url, 120, 250)}
              sizes="40px"
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              alt={`${artist.name} photo`}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ))}
        </div>

        {/* Primary actions, always reachable — no need to expand the row first. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative">
            <button
              onClick={handleVote}
              disabled={voteState === 'voting'}
              title={user ? `Vote for ${artist.name} this week` : 'Sign in to vote'}
              className="btn-gradient min-h-10 rounded-full px-3 py-2 text-sm font-semibold sm:px-4"
            >
              {voteState === 'voting' ? '…' : 'Vote'}
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
          </div>
          <button
            type="button"
            onClick={() => setPicsOpen(!picsOpen)}
            aria-expanded={picsOpen}
            aria-controls={`pictures-panel-${artist.id}`}
            aria-label={`${picsOpen ? 'Hide' : 'Show'} pictures of ${artist.name}`}
            title="Pictures — view and upload"
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-base transition ${
              picsOpen
                ? 'border-transparent bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]'
                : 'border-[var(--color-hairline)] hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]'
            }`}
          >
            📷
          </button>
          <Link
            to={`/artist/${artist.id}`}
            aria-label={`Open ${artist.name}'s page`}
            title="Open artist page"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-hairline)] text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:text-[var(--color-ink-soft-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Vote receipt + rally share, shown wherever the vote was cast from. */}
      {voteMessage && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-hairline)] px-4 py-2 dark:border-[var(--color-hairline-dark)]">
          <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            {voteMessage}
          </span>
          {voteState === 'voted' && (
            <ShareButton
              variant="inline"
              label={artist.fandomName ? `Rally ${artist.fandomName}` : 'Share this'}
              title={`${artist.name} on PsalmTune`}
              text={rallyText}
              copyMessage
              url={`https://psalmtune.com/artist/${artist.id}`}
            />
          )}
        </div>
      )}

      {/* Pictures live outside the expanded details: the 📷 button opens them directly. */}
      {picturesMounted && (
        <div
          id={`pictures-panel-${artist.id}`}
          hidden={!picsOpen}
          className="border-t border-[var(--color-hairline)] px-4 py-3 dark:border-[var(--color-hairline-dark)]"
        >
          <RowPicturesPanel artist={artist} />
        </div>
      )}

      {/* Expanding adds detail — the actions above never needed it. */}
      {expanded && (
        <div className="space-y-3 border-t border-[var(--color-hairline)] px-4 py-4 dark:border-[var(--color-hairline-dark)]">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              Members
            </h3>
            <p className="text-sm">{artist.members.map((m) => m.name).join(', ')}</p>
          </div>
          <p className="text-xs leading-snug text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Vote for up to 3 different artists each week — every vote counts toward their weekly and
            monthly totals and pushes them up the board.
          </p>
        </div>
      )}
    </div>
  )
}
