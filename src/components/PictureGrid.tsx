import { useState } from 'react'
import type { ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile, type UserProfile } from '../hooks/useUserProfile'
import { votePicture } from '../lib/callables'
import { sized, sizedSrcSet } from '../lib/images'
import { pictureCredit } from '../lib/labels'
import { plural } from '../lib/plural'
import { PICTURE_VOTES_PER_ARTIST, picturesVotesLeft, pictureVotesSpentText } from '../lib/pictureVotes'
import { HoverTip } from './HoverTip'

function PictureCard({
  picture,
  artistName,
  profile,
  onOpen,
}: {
  picture: ArtistPicture
  artistName: string
  profile: UserProfile | null
  onOpen?: (picture: ArtistPicture) => void
}) {
  const { user, signInWithGoogle } = useAuth()
  const [voteCount, setVoteCount] = useState(picture.voteCount)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  const handleVote = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    if (voted || pending) return
    setPending(true)
    setVoteError(null)
    try {
      const result = await votePicture({ pictureId: picture.id, artistId: picture.artistId })
      // `alreadyVoted` means a heart from an earlier visit — the filled state is the whole
      // answer, and the count comes back unchanged.
      setVoteCount(result.data.voteCount)
      setVoted(true)
    } catch (err) {
      // The daily heart cap and network failures both used to land here as a dead tap.
      setVoteError(err instanceof Error ? err.message : 'Could not heart that photo.')
    } finally {
      setPending(false)
    }
  }

  const credit = pictureCredit(picture)
  // Derived from the user doc this hook already streams — no per-picture read. A heart cast
  // in this session is `voted`, and the snapshot has already decremented for it.
  const votesLeft = picturesVotesLeft(profile, picture.artistId)
  // Rendered spent, but still clickable on purpose: the client never loads the user's vote
  // docs, so it cannot tell which three photos they hearted on an earlier visit. Blocking the
  // tap would strand exactly those three unfilled forever; letting it through fills them
  // (`alreadyVoted`, no quota spent) and otherwise surfaces the server's explanation below.
  const spent = !!user && !voted && votesLeft === 0

  return (
    <figure className="lift overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <button
        type="button"
        onClick={() => onOpen?.(picture)}
        className="block w-full"
        aria-label={`Open ${artistName} picture`}
      >
        <img
          src={sized(picture.url, 250)}
          srcSet={sizedSrcSet(picture.url, 250, 500)}
          sizes="(min-width: 640px) 240px, 45vw"
          alt={`${artistName} fan photo`}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full object-cover transition hover:opacity-90"
        />
      </button>
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        {/* The caption has ~70px at 390px while a CC credit needs ~241px, so it renders as
            "TOMORROW X TOGETHER · Public d…". Attribution nobody can read arguably isn't
            attribution — the title carries the full credit. */}
        <span className="truncate" title={credit}>
          {credit}
        </span>
        <div className="shrink-0">
          {/* Was a `group-hover:`-only block: invisible to keyboard users and to every phone
              visitor, which is most of them. HoverTip opens on focus as well as hover. */}
          <HoverTip
            align="right"
            width="w-52"
            tip={
              <>
                <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  How picture voting works
                </p>
                <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  You get {PICTURE_VOTES_PER_ARTIST} votes per artist, one per picture, and they don&rsquo;t
                  reset — spend them on {artistName}&rsquo;s best. The most-voted picture becomes their main
                  photo.{' '}
                  {user
                    ? `${plural(votesLeft, 'vote')} left for ${artistName}.`
                    : 'Sign in with Google to vote.'}
                </p>
              </>
            }
          >
            <button
              onClick={handleVote}
              disabled={voted || pending}
              aria-disabled={spent}
              title={spent ? pictureVotesSpentText(artistName) : undefined}
              aria-label={
                voted
                  ? 'Voted'
                  : spent
                    ? `No picture votes left for ${artistName}`
                    : 'Vote for this picture'
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-70 ${
                voted
                  ? 'bg-[var(--color-accent-strong)] text-white'
                  : spent
                    ? 'bg-[var(--color-surface-sunken)] opacity-50 dark:bg-[var(--color-surface-sunken-dark)]'
                    : 'bg-[var(--color-surface-sunken)] hover:opacity-80 dark:bg-[var(--color-surface-sunken-dark)]'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill={voted ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="tabular-nums">{voteCount}</span>
            </button>
          </HoverTip>
        </div>
      </figcaption>
      {voteError && <p className="px-3 pb-2 text-right text-xs text-red-500">{voteError}</p>}
    </figure>
  )
}

export function PictureGrid({
  pictures,
  artistName,
  onOpen,
}: {
  pictures: ArtistPicture[]
  artistName: string
  onOpen?: (picture: ArtistPicture) => void
}) {
  // One subscription for the whole grid rather than one per card. `useUserProfile` shares a
  // single Firestore listener per uid anyway, but reading it here keeps every card's
  // remaining-vote count derived from the same snapshot.
  const { profile } = useUserProfile()

  if (pictures.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        No pictures yet — be the first to upload one.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {pictures.map((picture) => (
        <PictureCard
          key={picture.id}
          picture={picture}
          artistName={artistName}
          profile={profile}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
