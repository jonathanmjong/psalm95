import { useEffect, useState } from 'react'
import type { ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { votePicture } from '../lib/callables'

interface Props {
  picture: ArtistPicture
  artistName: string
  onClose: () => void
  onUploadClick: () => void
  /** Called after a successful vote so parent sections can re-sort. */
  onVoted?: () => void
}

export function PictureLightbox({ picture, artistName, onClose, onUploadClick, onVoted }: Props) {
  const { user, signInWithGoogle } = useAuth()
  const [voteCount, setVoteCount] = useState(picture.voteCount)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

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
      onVoted?.()
    } catch {
      // Duplicate vote / offline — leave the button in its resting state.
    } finally {
      setPending(false)
    }
  }

  const credit =
    picture.source === 'wikimedia-seed' && picture.attribution
      ? `${picture.attribution.author} · ${picture.attribution.license}`
      : 'Community upload'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${artistName} picture`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={picture.url}
          alt={`${artistName} fan photo`}
          className="max-h-[60vh] w-full bg-black object-contain"
        />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              {credit}
            </span>
            <button
              onClick={handleVote}
              disabled={voted || pending}
              aria-label={voted ? 'Voted' : 'Vote for this picture'}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-70 ${
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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUploadClick}
              className="btn-gradient flex-1 rounded-full px-4 py-2 text-sm font-semibold"
            >
              Upload your own picture
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
