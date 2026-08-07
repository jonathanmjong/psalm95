import { useState } from 'react'
import type { ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { votePicture } from '../lib/callables'

function PictureCard({ picture }: { picture: ArtistPicture }) {
  const { user, signInWithGoogle } = useAuth()
  const [voteCount, setVoteCount] = useState(picture.voteCount)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)

  const handleVote = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    if (voted || pending) return
    setPending(true)
    try {
      const result = await votePicture({ pictureId: picture.id, artistId: picture.artistId })
      setVoteCount(result.data.voteCount)
      setVoted(true)
    } catch {
      // Duplicate votes / not-signed-in errors surface as a disabled state; no need to alarm the user.
    } finally {
      setPending(false)
    }
  }

  return (
    <figure className="lift overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <img src={picture.url} alt="" className="aspect-square w-full object-cover" />
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        <span className="truncate">
          {picture.source === 'wikimedia-seed' && picture.attribution
            ? `${picture.attribution.author} · ${picture.attribution.license}`
            : 'Community upload'}
        </span>
        <div className="group/vote relative shrink-0">
          <button
            onClick={handleVote}
            disabled={voted || pending}
            aria-label={voted ? 'Voted' : 'Vote for this picture'}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-70 ${
              voted
                ? 'bg-[var(--color-accent)] text-white'
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
          {/* Hover explainer: how picture voting works */}
          <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-52 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 text-left text-xs leading-snug shadow-lg group-hover/vote:block dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
            <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              How picture voting works
            </p>
            <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              Tap the heart to love a photo — one vote per picture. The most-voted photos rise to the top of
              the gallery. Sign in with Google to vote.
            </p>
          </div>
        </div>
      </figcaption>
    </figure>
  )
}

export function PictureGrid({ pictures }: { pictures: ArtistPicture[] }) {
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
        <PictureCard key={picture.id} picture={picture} />
      ))}
    </div>
  )
}
