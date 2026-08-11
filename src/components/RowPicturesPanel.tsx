import { useState } from 'react'
import type { Artist, ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useTopPictures } from '../hooks/useTopPictures'
import { PictureStrip } from './PictureStrip'
import { PictureLightbox } from './PictureLightbox'
import { UploadModal } from './UploadModal'

/** How many most-loved pictures the inline row strip shows. */
const PANEL_PICTURE_COUNT = 10

/**
 * The pictures panel that expands under a ranked row: a strip of the artist's most-loved
 * photos, the lightbox (heart voting) and the upload modal — everything the artist page
 * offers for pictures, without leaving the board.
 *
 * This component is mounted lazily by ArtistRow on first expand, so a collapsed row never
 * issues the Firestore read behind `useTopPictures`.
 */
export function RowPicturesPanel({ artist }: { artist: Artist }) {
  const { user, signInWithGoogle } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const { pictures, loading } = useTopPictures(artist.id, PANEL_PICTURE_COUNT, refreshKey)
  const [lightboxPic, setLightboxPic] = useState<ArtistPicture | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Re-query the strip after a heart vote (re-sorts), an upload or a delete.
  const refreshPictures = () => setRefreshKey((n) => n + 1)

  const openUpload = () => {
    if (user) setUploadOpen(true)
    else void signInWithGoogle()
  }

  return (
    <div className="mt-3 border-t border-[var(--color-hairline)] pt-3 dark:border-[var(--color-hairline-dark)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          ❤️ Most loved
        </h4>
        <button
          type="button"
          onClick={openUpload}
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
        >
          {user ? 'Upload' : 'Sign in to upload'}
        </button>
      </div>

      {loading ? (
        // Same footprint as the strip, so the panel does not resize once photos land.
        <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-square w-28 shrink-0 rounded-2xl bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]"
            />
          ))}
        </div>
      ) : pictures.length === 0 ? (
        <p className="pb-2 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No pictures yet — be the first to upload 📷
        </p>
      ) : (
        <PictureStrip
          pictures={pictures}
          artistName={artist.name}
          onOpen={setLightboxPic}
          showVotes
        />
      )}

      {lightboxPic && (
        <PictureLightbox
          picture={lightboxPic}
          artistName={artist.name}
          onClose={() => setLightboxPic(null)}
          onVoted={refreshPictures}
          onDeleted={refreshPictures}
          onUploadClick={() => {
            setLightboxPic(null)
            openUpload()
          }}
        />
      )}

      {uploadOpen && (
        <UploadModal
          artistId={artist.id}
          members={artist.members}
          onClose={() => setUploadOpen(false)}
          onUploaded={refreshPictures}
        />
      )}
    </div>
  )
}
