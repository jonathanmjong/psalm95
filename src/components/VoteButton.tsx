import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Artist } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { ShareButton } from './ShareButton'
import { HoverTip } from './HoverTip'
import { castArtistVote } from '../lib/callables'
import { celebrateStreak } from '../lib/streak'
import { currentWeekId, msUntilWeeklyReset, formatCountdown } from '../lib/dates'
import { plural } from '../lib/plural'

/** Mirrors WEEKLY_VOTE_LIMIT in functions/src/votes.ts. */
const WEEKLY_VOTE_LIMIT = 3

interface Props {
  artist: Artist
  /** Called once a vote lands, so the surrounding surface can respond — the board row uses it
   *  to bump its optimistic weekly-vote count. */
  onVoted?: () => void
  /** `row` is the compact pill in a board row; `primary` is the prominent gradient CTA on the
   *  artist page, where voting is the whole point of the visit. */
  variant?: 'row' | 'primary'
  /** Where to render the post-vote receipt. Board rows hand over their own full-width strip
   *  below the row header — the button itself sits in a narrow action cluster that a receipt
   *  would otherwise stretch. Omit it and the receipt renders in place, under the button. */
  receiptContainer?: HTMLElement | null
  /** Rank to claim in the rally message when the artist doc has none yet (board position). */
  fallbackRank?: number
}

/** The one place a vote is cast from: sign-in gating, the callable, the "+1" float, the vote
 * receipt, the streak celebration and the rally share. Used by the board row and by the
 * artist page, which every share link, prerendered page, fandom row and birthday chip lands
 * on — voting has to be possible there without a trip back to Home. */
export function VoteButton({ artist, onVoted, variant = 'row', receiptContainer, fallbackRank }: Props) {
  const { user, signInWithGoogle } = useAuth()
  // Shared listener (see useUserProfile) — a board full of rows costs one subscription.
  // Only used for the handle the streak brag links to.
  const { profile } = useUserProfile()
  const [voteState, setVoteState] = useState<'idle' | 'voting' | 'voted' | 'error'>('idle')
  const [voteMessage, setVoteMessage] = useState<string | null>(null)
  /** Non-zero while a "+1" receipt is floating off the vote button; the value doubles as
   * the animation's restart key so rapid votes each get their own float. */
  const [floatId, setFloatId] = useState(0)

  useEffect(() => {
    if (!floatId) return
    const t = setTimeout(() => setFloatId(0), 1000)
    return () => clearTimeout(t)
  }, [floatId])

  // The rally a fresh vote is worth sharing. The rank claimed here is the artist's own
  // board rank — `artist.rank` as recomputed server-side, falling back to the position
  // the caller renders them at — never an invented fandom-board standing, which only the
  // live /fandoms race knows.
  const shareRank = artist.rank > 0 ? artist.rank : (fallbackRank ?? artist.rank)
  const rallyText = artist.fandomName
    ? `I just voted for ${artist.name} on PsalmTune 💜 They’re #${shareRank} on the board — ${artist.fandomName}, help us climb!`
    : `I just voted for ${artist.name} on PsalmTune — they’re #${shareRank}. Every vote moves the board.`

  const handleVote = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    // Out of votes: answer on the spot instead of spending a round trip to be told no. The
    // button stays tappable precisely so this message is reachable — a disabled button on a
    // touch device explains nothing.
    if (outOfVotes) {
      setVoteState('error')
      setVoteMessage(
        `You've used all ${WEEKLY_VOTE_LIMIT} of your votes this week. You get 3 more in ${formatCountdown(
          msUntilWeeklyReset(),
        )} (Monday).`,
      )
      return
    }
    setVoteState('voting')
    setVoteMessage(null)
    try {
      const result = await castArtistVote({ artistId: artist.id })
      setVoteState('voted')
      setFloatId(Date.now())
      const streak = result.data.currentStreak
      const streakMsg = streak > 1 ? ` · 🔥 ${streak}-day streak!` : ''
      setVoteMessage(`Vote cast — ${result.data.weeklyVotesRemaining} left this week.${streakMsg}`)
      celebrateStreak(result.data, { handle: profile?.handle })
      onVoted?.()
    } catch (err) {
      setVoteState('error')
      setVoteMessage(err instanceof Error ? err.message : 'Could not cast vote.')
    }
  }

  const receipt = voteMessage ? (
    <div
      className={
        receiptContainer
          ? 'flex flex-wrap items-center gap-2 border-t border-[var(--color-hairline)] px-4 py-2 dark:border-[var(--color-hairline-dark)]'
          : 'flex w-full flex-wrap items-center gap-2'
      }
    >
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
  ) : null

  const votesUsed = profile?.weeklyArtistVotes?.[currentWeekId()]?.length ?? 0
  const votesLeft = Math.max(0, WEEKLY_VOTE_LIMIT - votesUsed)
  /**
   * Whether *this* user has already spent a vote on this artist this week. Read from the
   * profile, so it survives a reload and shows up on every surface the artist appears on —
   * not just the button that was clicked. `voteState` covers the gap between the vote
   * landing and the profile listener catching up.
   */
  const votedForThisArtist =
    voteState === 'voted' || (profile?.weeklyArtistVotes?.[currentWeekId()]?.includes(artist.id) ?? false)
  const alreadyVotedThisWeek = votedForThisArtist
  /** Signed in, all three votes spent, and none of them on this artist. */
  const outOfVotes = !!user && votesLeft === 0 && !votedForThisArtist

  const tip = (
    <>
      <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
        {artist.name} · {plural(artist.weeklyVotes, 'vote')} this week
      </p>
      <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        {artist.monthlyVotes.toLocaleString()} this month · {artist.yearlyVotes.toLocaleString()} this year
      </p>
      <p className="mt-1.5 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        {!user
          ? 'Sign in to vote — 3 votes a week, one per artist.'
          : alreadyVotedThisWeek
            ? `You already voted for ${artist.name} this week. ${plural(votesLeft, 'vote')} left for other artists.`
            : outOfVotes
              ? `All ${WEEKLY_VOTE_LIMIT} of your votes are spent. You get 3 more in ${formatCountdown(msUntilWeeklyReset())} (Monday).`
              : `You have ${votesLeft} of 3 votes left this week. Votes reset Monday.`}
      </p>
    </>
  )

  return (
    <>
      <HoverTip tip={tip} width="w-60">
        <div className="relative">
          {/* Once you've voted for this artist the button becomes a receipt rather than a
              call to action: the server rejects a second vote for the same artist this week,
              so offering the tap again would only produce an error. */}
          <button
            onClick={handleVote}
            disabled={voteState === 'voting' || votedForThisArtist}
            aria-label={
              votedForThisArtist
                ? `You voted for ${artist.name} this week`
                : outOfVotes
                  ? 'No votes left this week — see when they reset'
                  : `Vote for ${artist.name}`
            }
            className={
              votedForThisArtist
                ? `inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-100 ${
                    variant === 'primary' ? 'px-5 py-2' : 'px-3 py-2 sm:px-4'
                  }`
                : outOfVotes
                  ? // Muted rather than gradient, so a spent ballot doesn't keep shouting for a
                    // tap — but still tappable, because tapping is how the reason is delivered.
                    `inline-flex min-h-10 items-center rounded-full border border-[var(--color-hairline)] text-sm font-semibold text-[var(--color-ink-soft)] dark:border-[var(--color-hairline-dark)] dark:text-[var(--color-ink-soft-dark)] ${
                      variant === 'primary' ? 'px-5 py-2' : 'px-3 py-2 sm:px-4'
                    }`
                  : variant === 'primary'
                    ? 'btn-gradient min-h-10 rounded-full px-5 py-2 text-sm font-semibold'
                    : 'btn-gradient min-h-10 rounded-full px-3 py-2 text-sm font-semibold sm:px-4'
            }
          >
            {voteState === 'voting' ? (
              '…'
            ) : votedForThisArtist ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {variant === 'primary' ? `Voted for ${artist.name}` : 'Voted'}
              </>
            ) : outOfVotes ? (
              variant === 'primary' ? (
                'No votes left this week'
              ) : (
                'No votes left'
              )
            ) : variant === 'primary' ? (
              `Vote for ${artist.name}`
            ) : (
              'Vote'
            )}
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
      </HoverTip>
      {receipt && (receiptContainer ? createPortal(receipt, receiptContainer) : receipt)}
    </>
  )
}
