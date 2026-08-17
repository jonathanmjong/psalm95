import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useArtist } from '../hooks/useArtist'
import { useArtistPictures, type PictureSort } from '../hooks/useArtistPictures'
import { useTopPictures } from '../hooks/useTopPictures'
import { useLatestPictures } from '../hooks/useLatestPictures'
import type { ArtistPicture } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { MemberFilter } from '../components/MemberFilter'
import { SortControl } from '../components/SortControl'
import { PictureGrid } from '../components/PictureGrid'
import { PictureStrip } from '../components/PictureStrip'
import { PictureLightbox } from '../components/PictureLightbox'
import { Pagination } from '../components/Pagination'
import { ScoreBreakdown, SCORE_LEGEND } from '../components/ScoreBreakdown'
import { UploadModal } from '../components/UploadModal'
import { RankingTrend } from '../components/RankingTrend'
import { ArtistAbout } from '../components/ArtistAbout'
import { Comments } from '../components/Comments'
import { ShareButton } from '../components/ShareButton'
import { JoinFandomButton } from '../components/JoinFandomButton'
import { VoteButton } from '../components/VoteButton'
import { HoverTip } from '../components/HoverTip'
import { NotFound } from './NotFound'
import { usePageMeta } from '../hooks/usePageMeta'
import { birthdayStatus } from '../lib/birthdays'
import { sized, sizedSrcSet } from '../lib/images'
import { uploadCtaLabel } from '../lib/labels'

const REGION_LABEL: Record<'KR' | 'CN' | 'JP', string> = {
  KR: 'K-pop',
  CN: 'C-pop',
  JP: 'J-pop',
}

export function ArtistPage() {
  const { artistId } = useParams()
  const { artist, loading: artistLoading, error: artistError } = useArtist(artistId)
  const { user, signInWithGoogle } = useAuth()
  const [sort, setSort] = useState<PictureSort>('date')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [lightboxPic, setLightboxPic] = useState<ArtistPicture | null>(null)
  const [picRefresh, setPicRefresh] = useState(0)
  const { pictures: topPictures } = useTopPictures(artistId ?? '', 10, picRefresh)
  const { pictures: latestPictures } = useLatestPictures(artistId ?? '', 10, picRefresh)
  const heroPicture = topPictures[0] ?? null

  // Which members the picture filter can actually offer. `memberPhotoUrls` is
  // memberId → best photo that member is tagged in, denormalized onto the artist doc hourly
  // by recomputeRankings — the same `taggedMembers` data the `taggedMemberKeys` query filters
  // on, already loaded with the artist and costing no extra read.
  const taggedMemberIds = useMemo(() => {
    if (artist?.memberPhotoUrls) return new Set(Object.keys(artist.memberPhotoUrls))
    // Artist docs written before that job started denormalizing: fall back to the tags on
    // the pictures already on screen rather than querying just to populate a <select>.
    const ids = new Set<string>()
    for (const pic of [...topPictures, ...latestPictures]) {
      for (const tag of pic.taggedMembers ?? []) {
        if (tag.artistId === artistId) ids.add(tag.memberId)
      }
    }
    return ids
  }, [artist?.memberPhotoUrls, topPictures, latestPictures, artistId])

  // A selection can outlive its option (a photo deleted, an hourly recompute). Filtering by a
  // member the control no longer offers would strand the grid on an empty result with no
  // visible way back, so it falls back to "All members".
  const activeMemberId = memberId && taggedMemberIds.has(memberId) ? memberId : null

  const { pictures, loading, page, hasMore, nextPage, prevPage, refresh } = useArtistPictures(
    artistId ?? '',
    sort,
    activeMemberId,
  )

  // Re-query the curated strips (and the paginated grid) after a vote or a new upload.
  const refreshPictures = () => {
    setPicRefresh((n) => n + 1)
    refresh()
  }

  const region = artist ? REGION_LABEL[artist.region] : ''
  const memberNames = artist?.members.map((m) => m.name).join(', ')
  // Share card: the artist's top-voted photo, falling back to the denormalized index
  // thumbnails and finally to the site default card in usePageMeta. The prerendered shell
  // (scripts/prerender.mjs) carries the same shape for non-JS scrapers, minus the "of N"
  // roster size, which the client doesn't load just to title a page.
  const sharePicture = heroPicture?.url ?? artist?.topPictureUrls?.[0]
  usePageMeta({
    title: artist
      ? `${artist.name} — #${artist.rank} · ${region} ranking, profile & pictures | PsalmTune`
      : 'Artist | PsalmTune',
    description: artist
      ? `Vote for ${artist.name} and follow their popularity and fan-vote ranking. Explore ${
          artist.type === 'group' ? `member profiles (${memberNames})` : 'their profile'
        }, fandom and rank on PsalmTune — the fan-driven ${region} ranking platform.`
      : undefined,
    path: artistId ? `/artist/${artistId}` : undefined,
    image: sharePicture,
    imageAlt: artist && sharePicture ? `${artist.name} — ${region} artist on PsalmTune` : undefined,
  })

  if (artistLoading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Loading artist…
      </p>
    )
  }

  // A backend failure is not a missing artist. Saying "doesn't exist" on an outage misleads
  // the visitor and, on a page every share link points at, tells crawlers it's a soft 404.
  if (!artist && artistError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Couldn’t load this artist</h1>
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          We couldn’t reach the board just now. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-gradient inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
        >
          Retry
        </button>
      </div>
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

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {heroPicture && (
          <button
            type="button"
            onClick={() => setLightboxPic(heroPicture)}
            className="group relative mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-3xl border border-[var(--color-hairline)] sm:mx-0 dark:border-[var(--color-hairline-dark)]"
            aria-label={`Open ${artist.name}'s most-loved picture`}
          >
            <img
              src={sized(heroPicture.url, 250)}
              srcSet={sizedSrcSet(heroPicture.url, 250, 500)}
              sizes="176px"
              width={176}
              height={176}
              decoding="async"
              alt={`${artist.name} — fan favorite`}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            {heroPicture.voteCount > 0 && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {heroPicture.voteCount}
              </span>
            )}
          </button>
        )}
        {/* Four artists currently have no freely-licensed photo at all, and this slot used to
            render nothing — so the one page where a fan could fix that offered no hint they
            could. The placeholder occupies the same 176px square and opens the uploader. */}
        {!heroPicture && (
          <HoverTip
            width="w-56"
            tip={
              <>
                <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  No picture of {artist.name} yet
                </p>
                <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  {user
                    ? 'Add the first one — the most-loved photo becomes their picture across the site.'
                    : 'Sign in to add the first one — the most-loved photo becomes their picture across the site.'}
                </p>
              </>
            }
          >
            <button
              type="button"
              onClick={() => (user ? setUploadOpen(true) : signInWithGoogle())}
              aria-label={`${uploadCtaLabel(!!user)} of ${artist.name} — no picture yet`}
              className="group mx-auto flex h-44 w-44 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-[var(--color-hairline)] text-center transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 sm:mx-0 dark:border-[var(--color-hairline-dark)]"
            >
              <span className="text-3xl" aria-hidden>
                📷
              </span>
              <span className="px-3 text-xs font-semibold text-[var(--color-ink-soft)] transition group-hover:text-[var(--color-accent)] dark:text-[var(--color-ink-soft-dark)]">
                {user ? 'Add the first picture' : 'Sign in to add a picture'}
              </span>
            </button>
          </HoverTip>
        )}
        <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{artist.name}</h1>
          {artist.rank > 0 && (
            // The share card that brought most visitors here leads with the rank; without it
            // on the page the promise evaporates the moment they arrive.
            <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-sm font-bold text-[var(--color-accent)] tabular-nums">
              #{artist.rank}
            </span>
          )}
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
        {/* Voting is the point of this page — every share link, prerendered result, fandom row
            and birthday chip lands here, so the primary action lives here too. */}
        <div className="flex flex-wrap items-center gap-3">
          <VoteButton artist={artist} variant="primary" />
          <JoinFandomButton artist={artist} />
        </div>
        {/* The scarcity rule lived only in a hover tooltip, which does not exist on touch —
            so the visitor most likely to be here had no idea what a vote costs. */}
        <p className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          {artist.weeklyVotes > 0
            ? `${artist.weeklyVotes.toLocaleString()} ${artist.weeklyVotes === 1 ? 'vote' : 'votes'} this week · `
            : ''}
          You get 3 votes a week, one per artist. They reset every Monday.
        </p>
        <div className="max-w-sm">
          <ScoreBreakdown artist={artist} />
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            {/* The bar had no legend on this page, so it read as three decorative pills. */}
            {SCORE_LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.cssVar }} aria-hidden />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        </div>
      </header>

      <section>
        <RankingTrend artistId={artist.id} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">About</h2>
        <ArtistAbout artist={artist} />
      </section>

      {topPictures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">❤️ Most loved</h2>
          <PictureStrip pictures={topPictures} artistName={artist.name} onOpen={setLightboxPic} showVotes />
        </section>
      )}

      {latestPictures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">🆕 Latest uploads</h2>
          <PictureStrip pictures={latestPictures} artistName={artist.name} onOpen={setLightboxPic} />
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">All pictures</h2>
          <div className="flex flex-wrap items-center gap-3">
            <MemberFilter
              members={artist.members}
              taggedMemberIds={taggedMemberIds}
              value={activeMemberId}
              onChange={setMemberId}
            />
            <SortControl value={sort} onChange={setSort} />
            <button
              onClick={() => (user ? setUploadOpen(true) : signInWithGoogle())}
              className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold"
            >
              {uploadCtaLabel(!!user)}
            </button>
          </div>
        </div>

        {/* Loading copy only when the grid is genuinely empty — a cached page paints
            immediately, and a post-vote refresh keeps the photos up while it re-reads. */}
        {loading && pictures.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Loading pictures…
          </p>
        ) : (
          <PictureGrid pictures={pictures} artistName={artist.name} onOpen={setLightboxPic} />
        )}

        <Pagination page={page} hasMore={hasMore} loading={loading} onPrev={prevPage} onNext={nextPage} />
      </section>

      <Comments artistId={artist.id} />

      {lightboxPic && (
        <PictureLightbox
          picture={lightboxPic}
          artistName={artist.name}
          onClose={() => setLightboxPic(null)}
          onVoted={refreshPictures}
          onDeleted={refreshPictures}
          onUploadClick={() => {
            setLightboxPic(null)
            if (user) setUploadOpen(true)
            else signInWithGoogle()
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
