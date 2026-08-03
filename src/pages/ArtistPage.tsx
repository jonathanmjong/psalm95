import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useArtist } from '../hooks/useArtist'
import { useArtistPictures, type PictureSort } from '../hooks/useArtistPictures'
import { useAuth } from '../contexts/AuthContext'
import { MemberFilter } from '../components/MemberFilter'
import { SortControl } from '../components/SortControl'
import { PictureGrid } from '../components/PictureGrid'
import { Pagination } from '../components/Pagination'
import { ScoreBreakdown } from '../components/ScoreBreakdown'
import { UploadModal } from '../components/UploadModal'

const REGION_LABEL: Record<'KR' | 'CN' | 'JP', string> = {
  KR: 'K-pop',
  CN: 'C-pop',
  JP: 'J-pop',
}

export function ArtistPage() {
  const { artistId } = useParams()
  const { artist, loading: artistLoading } = useArtist(artistId)
  const { user, signInWithGoogle } = useAuth()
  const [sort, setSort] = useState<PictureSort>('date')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const { pictures, loading, page, hasMore, nextPage, prevPage, refresh } = useArtistPictures(
    artistId ?? '',
    sort,
    memberId,
  )

  if (artistLoading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Loading artist…
      </p>
    )
  }

  if (!artist) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Artist not found.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="text-sm text-[var(--color-ink-soft)] hover:underline dark:text-[var(--color-ink-soft-dark)]"
      >
        ← Back to rankings
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{artist.name}</h1>
          <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-xs font-medium dark:bg-[var(--color-surface-sunken-dark)]">
            {REGION_LABEL[artist.region]}
          </span>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {artist.members.map((m) => m.name).join(', ')}
        </p>
        <div className="max-w-sm">
          <ScoreBreakdown artist={artist} />
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pictures</h2>
          <div className="flex items-center gap-3">
            <MemberFilter members={artist.members} value={memberId} onChange={setMemberId} />
            <SortControl value={sort} onChange={setSort} />
            <button
              onClick={() => (user ? setUploadOpen(true) : signInWithGoogle())}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Upload picture
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Loading pictures…
          </p>
        ) : (
          <PictureGrid pictures={pictures} />
        )}

        <Pagination page={page} hasMore={hasMore} loading={loading} onPrev={prevPage} onNext={nextPage} />
      </section>

      {uploadOpen && (
        <UploadModal
          artistId={artist.id}
          members={artist.members}
          onClose={() => setUploadOpen(false)}
          onUploaded={refresh}
        />
      )}
    </div>
  )
}
