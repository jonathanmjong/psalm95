import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Artist } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { ShareButton } from './ShareButton'
import { castArtistVote } from '../lib/callables'
import { celebrateStreak } from '../lib/streak'

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

  return (
    <>
      <div className="relative">
        <button
          onClick={handleVote}
          disabled={voteState === 'voting'}
          title={user ? `Vote for ${artist.name} this week` : 'Sign in to vote'}
          className={
            variant === 'primary'
              ? 'btn-gradient min-h-10 rounded-full px-5 py-2 text-sm font-semibold'
              : 'btn-gradient min-h-10 rounded-full px-3 py-2 text-sm font-semibold sm:px-4'
          }
        >
          {voteState === 'voting' ? '…' : variant === 'primary' ? `Vote for ${artist.name}` : 'Vote'}
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
      {receipt && (receiptContainer ? createPortal(receipt, receiptContainer) : receipt)}
    </>
  )
}
