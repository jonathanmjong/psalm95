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
import { RankingTrend } from '../components/RankingTrend'
import { ArtistAbout } from '../components/ArtistAbout'
import { Comments } from '../components/Comments'
import { ShareButton } from '../components/ShareButton'
import { NotFound } from './NotFound'
import { usePageMeta } from '../hooks/usePageMeta'
import { birthdayStatus } from '../lib/birthdays'

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

  const region = artist ? REGION_LABEL[artist.region] : ''
  const memberNames = artist?.members.map((m) => m.name).join(', ')
  usePageMeta({
    title: artist ? `${artist.name} — ${region} profile, ranking & pictures | PsalmTune` : 'Artist | PsalmTune',
    description: artist
      ? `Vote for ${artist.name} and follow their popularity, discography and concerts. Explore ${
          artist.type === 'group' ? `member profiles (${memberNames})` : 'their profile'
        }, fandom and rank on PsalmTune — the fan-driven ${region} ranking platform.`
      : undefined,
    path: artistId ? `/artist/${artistId}` : undefined,
  })

  if (artistLoading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Loading artist…
      </p>
    )
  }

  if (!artist) {
    return <NotFound />
  }

  // Members with a birthday today → celebration banner.
  const birthdayToday = artist.members.filter((m) => m.birthdate && birthdayStatus(m.birthdate)?.isToday)

  return (
    <div className="space-y-8">
      <Link
        to="/"
        className="text-sm text-[var(--color-ink-soft)] hover:underline dark:text-[var(--color-ink-soft-dark)]"
      >
        ← Back to rankings
      </Link>

      {birthdayToday.length > 0 && (
        <div className="btn-gradient rounded-2xl px-5 py-4 text-center font-semibold">
          🎉 Happy Birthday {birthdayToday.map((m) => m.name).join(' & ')}! Celebrate {artist.name} today.
        </div>
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{artist.name}</h1>
          <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-xs font-medium dark:bg-[var(--color-surface-sunken-dark)]">
            {REGION_LABEL[artist.region]}
          </span>
          {artist.fandomName && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={
                artist.fandomColorHex
                  ? { backgroundColor: `${artist.fandomColorHex}22`, borderColor: `${artist.fandomColorHex}66` }
                  : undefined
              }
            >
              {artist.fandomColorHex && (
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: artist.fandomColorHex }}
                  aria-hidden
                />
              )}
              {artist.fandomName}
            </span>
          )}
          <div className="ml-auto">
            <ShareButton
              title={`${artist.name} on PsalmTune`}
              text={`Vote for ${artist.name} on PsalmTune — the fan-driven ${REGION_LABEL[artist.region]} ranking.`}
              url={`https://psalmtune.com/artist/${artist.id}`}
            />
          </div>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {artist.members.map((m) => m.name).join(', ')}
        </p>
        <div className="max-w-sm">
          <ScoreBreakdown artist={artist} />
        </div>
      </header>

      <section>
        <RankingTrend artistId={artist.id} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">About</h2>
        <ArtistAbout artist={artist} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pictures</h2>
          <div className="flex flex-wrap items-center gap-3">
            <MemberFilter members={artist.members} value={memberId} onChange={setMemberId} />
            <SortControl value={sort} onChange={setSort} />
            <button
              onClick={() => (user ? setUploadOpen(true) : signInWithGoogle())}
              className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold"
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
          <PictureGrid pictures={pictures} artistName={artist.name} />
        )}

        <Pagination page={page} hasMore={hasMore} loading={loading} onPrev={prevPage} onNext={nextPage} />
      </section>

      <Comments artistId={artist.id} />

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
