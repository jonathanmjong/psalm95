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
    <figure className="overflow-hidden rounded-2xl border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      <img src={picture.url} alt="" className="aspect-square w-full object-cover" />
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        <span className="truncate">
          {picture.source === 'wikimedia-seed' && picture.attribution
            ? `${picture.attribution.author} · ${picture.attribution.license}`
            : 'Community upload'}
        </span>
        <button
          onClick={handleVote}
          disabled={voted || pending}
          className="shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 font-medium transition hover:opacity-80 disabled:opacity-60 dark:bg-[var(--color-surface-sunken-dark)]"
        >
          ♥ {voteCount}
        </button>
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
