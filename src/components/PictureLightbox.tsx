import { useState } from 'react'
import type { ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { deletePicture, votePicture } from '../lib/callables'
import { sized } from '../lib/images'
import { Modal } from './Modal'

interface Props {
  picture: ArtistPicture
  artistName: string
  onClose: () => void
  onUploadClick: () => void
  /** Called after a successful vote so parent sections can re-sort. */
  onVoted?: () => void
  /** Called after the owner deletes this picture so parent sections can drop it. */
  onDeleted?: () => void
}

export function PictureLightbox({ picture, artistName, onClose, onUploadClick, onVoted, onDeleted }: Props) {
  const { user, signInWithGoogle } = useAuth()
  const [voteCount, setVoteCount] = useState(picture.voteCount)
  const [voted, setVoted] = useState(false)
  const [pending, setPending] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const ownUpload = picture.source === 'user-upload' && picture.uploadedBy === user?.uid

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
      setVoteCount(result.data.voteCount)
      setVoted(true)
      // A heart from an earlier visit is a no-op server-side: fill the heart, but don't ask
      // the parent sections to re-sort over an unchanged count.
      if (!result.data.alreadyVoted) onVoted?.()
    } catch (err) {
      // The daily heart cap and network failures both used to land here as a dead tap.
      setVoteError(err instanceof Error ? err.message : 'Could not heart that photo.')
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deletePicture({ pictureId: picture.id, artistId: picture.artistId })
      onDeleted?.()
      onClose()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete that photo.')
      setDeleting(false)
    }
  }

  const credit =
    picture.source === 'wikimedia-seed' && picture.attribution
      ? `${picture.attribution.author} · ${picture.attribution.license}`
      : 'Community upload'

  return (
    <Modal
      onClose={onClose}
      label={`${artistName} picture`}
      backdropClassName="z-[60] bg-black/70"
      panelClassName="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]"
    >
      <img
        src={sized(picture.url, 1280)}
        alt={`${artistName} fan photo`}
        decoding="async"
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
                ? 'bg-[var(--color-accent-strong)] text-white'
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
        {voteError && <p className="text-right text-xs text-red-500">{voteError}</p>}
        {ownUpload &&
          (confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                Delete this photo?
              </span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="ml-auto rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-full border border-[var(--color-hairline)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-50 dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="ml-auto flex items-center gap-1 text-xs text-[var(--color-ink-soft)] transition hover:text-[var(--color-accent)] dark:text-[var(--color-ink-soft-dark)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
              </svg>
              Delete
            </button>
          ))}

        {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}

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
    </Modal>
  )
}
