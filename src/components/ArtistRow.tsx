import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Artist } from '../types'
import { useTopPictures } from '../hooks/useTopPictures'
import { ScoreBreakdown } from './ScoreBreakdown'
import { ArtistMiniGraph } from './ArtistMiniGraph'
import { RowPicturesPanel } from './RowPicturesPanel'
import { VoteButton } from './VoteButton'
import { HoverTip } from './HoverTip'
import { sized, sizedSrcSet } from '../lib/images'

const REGION_LABEL: Record<Artist['region'], string> = {
  KR: 'K-pop',
  CN: 'C-pop',
  JP: 'J-pop',
}

/** Touch devices navigate in-tab: on iOS a `target="_blank"` row would spawn a new tab on
 *  every single tap and break the back gesture. Mouse/trackpad users keep the new tab, which
 *  is what the board was explicitly asked for. Pointer type doesn't change under a device,
 *  so this is safe to read once. */
const COARSE_POINTER =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true

interface Props {
  artist: Artist
  rank: number
  /** Controlled pictures-panel state, so only one row's panel is open at a time.
   *  Omit both props and the row manages the panel on its own. */
  picturesOpen?: boolean
  onPicturesToggle?: (open: boolean) => void
}

export function ArtistRow({ artist, rank, picturesOpen, onPicturesToggle }: Props) {
  const [localPicturesOpen, setLocalPicturesOpen] = useState(false)
  /** True once the pictures panel has been opened at least once. The panel — and the
   *  Firestore read inside it — is mounted only from then on, so the 12 rows on a Home
   *  page cost nothing extra until someone actually asks for pictures. */
  const [picturesMounted, setPicturesMounted] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  // Thumbnails come from the hourly-denormalized topPictureUrls when present (zero reads);
  // the per-row pictures query only runs for docs that predate that field.
  const { pictures } = useTopPictures(artist.id, 5, 0, !artist.topPictureUrls)
  const thumbUrls = artist.topPictureUrls ?? pictures.map((p) => p.url)
  /** Votes cast from this row in this session — applied locally so the weekly-votes segment
   * responds immediately. The composite score and rank are recomputed hourly and are
   * deliberately left untouched. */
  const [localVotes, setLocalVotes] = useState(0)
  /** The row's own full-width receipt strip, handed to VoteButton so its receipt lands below
   * the row header instead of inside the narrow action cluster. */
  const [receiptSlot, setReceiptSlot] = useState<HTMLDivElement | null>(null)

  const picsOpen = picturesOpen ?? localPicturesOpen

  const setPicsOpen = (open: boolean) => {
    if (open) setPicturesMounted(true)
    setLocalPicturesOpen(open)
    onPicturesToggle?.(open)
  }

  return (
    <div
      data-artist-row={artist.id}
      className="relative rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] transition-shadow duration-200 hover:shadow-md dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setCursor(null)}
    >
      {/* Popularity ranking trend that follows the cursor (desktop only; mobile users expand
          the row). position:fixed + high z keeps it above everything, instantly. */}
      {!picsOpen && cursor && (
        <div
          className="pointer-events-none fixed z-50 hidden md:block"
          style={{
            left: Math.min(cursor.x + 18, window.innerWidth - 252),
            top: Math.min(cursor.y + 18, window.innerHeight - 168),
          }}
        >
          <ArtistMiniGraph artist={artist} />
        </div>
      )}
      {/* The row header is a flex container, not one big <button>: the primary actions live
          here now, and interactive elements can't legally nest inside a button. */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* A real link, so cmd/middle-click and "open in new tab" behave the way the rest of
            the web does. On a mouse it opens the artist page in a new tab; on touch it routes
            in-tab (see COARSE_POINTER) so the back gesture keeps working. */}
        <Link
          to={`/artist/${artist.id}`}
          {...(COARSE_POINTER ? {} : { target: '_blank', rel: 'noopener' })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
        >
          <span
            className={`w-8 shrink-0 text-center tabular-nums ${
              rank === 1
                ? 'text-xl font-extrabold text-yellow-400'
                : rank === 2
                  ? 'text-xl font-extrabold text-slate-400'
                  : rank === 3
                    ? 'text-xl font-extrabold text-amber-600'
                    : 'text-lg font-semibold text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
            }`}
          >
            {rank}
          </span>
          {thumbUrls[0] ? (
            <img
              src={sized(thumbUrls[0], 120)}
              srcSet={sizedSrcSet(thumbUrls[0], 120, 250)}
              sizes="48px"
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              alt={artist.name}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Phones give the name column ~140px, and plenty of names need more than that
                  ("TOMORROW X TOGETHER" wants 201px), so below sm the name wraps instead of
                  truncating to two letters. From sm up there is room for one line. */}
              <span data-artist-name className="font-semibold break-words sm:truncate">
                {artist.name}
              </span>
              <span className="hidden shrink-0 rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-xs text-[var(--color-ink-soft)] sm:inline dark:bg-[var(--color-surface-sunken-dark)] dark:text-[var(--color-ink-soft-dark)]">
                {REGION_LABEL[artist.region]}
              </span>
            </div>
            {/* The score bar shares the name's width only where that width is comfortable;
                on phones it moves to its own full-width line below the row header. */}
            <div className="mt-1.5 hidden max-w-xs sm:block">
              <ScoreBreakdown artist={artist} pendingVotes={localVotes} />
            </div>
          </div>
        </Link>

        <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {thumbUrls.slice(0, 4).map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={sized(url, 120)}
              srcSet={sizedSrcSet(url, 120, 250)}
              sizes="40px"
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              alt={`${artist.name} photo`}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ))}
        </div>

        {/* Primary actions, always reachable — no need to expand the row first. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <VoteButton
            artist={artist}
            fallbackRank={rank}
            receiptContainer={receiptSlot}
            onVoted={() => setLocalVotes((n) => n + 1)}
          />
          <HoverTip
            align="right"
            width="w-64"
            tip={
              <>
                <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Photos of {artist.name}
                </p>
                <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  Opens the fan gallery right here in the row. Tap any photo to view it full size and
                  heart the ones you love — the most-loved photo becomes their picture on the board.
                </p>
                <p className="mt-1.5 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  To add your own: hit <strong>Upload</strong> in the gallery, pick an image (under
                  10 MB), tag the members in it, and confirm you have the rights to share it. You can
                  have 3 uploads at a time — delete one to free a slot.
                </p>
              </>
            }
          >
            <button
              type="button"
              onClick={() => setPicsOpen(!picsOpen)}
              aria-expanded={picsOpen}
              aria-controls={`pictures-panel-${artist.id}`}
              aria-label={`${picsOpen ? 'Hide' : 'Show'} pictures of ${artist.name}`}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-base transition ${
                picsOpen
                  ? 'border-transparent bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]'
                  : 'border-[var(--color-hairline)] hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]'
              }`}
            >
              📷
            </button>
          </HoverTip>
          {/* "Open in a new tab" is a pointer affordance and the whole row already goes to the
              same page — below sm it only stole width from the artist's name. */}
          <div className="hidden sm:block">
          <HoverTip
            align="right"
            width="w-64"
            tip={
              <>
                <p className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  {artist.name} · #{artist.rank > 0 ? artist.rank : rank} {REGION_LABEL[artist.region]}
                </p>
                {artist.fandomName && (
                  <p className="mt-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                    Fandom: {artist.fandomName}
                  </p>
                )}
                {artist.members.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                    {artist.members.map((m) => m.name).join(', ')}
                  </p>
                )}
                <p className="mt-1.5 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  Full profile: member bios, birthdays, ranking history, photo gallery and comments.
                  <strong> Click to open in a new tab.</strong>
                </p>
              </>
            }
          >
            <a
              href={`/artist/${artist.id}`}
              target="_blank"
              rel="noopener"
              aria-label={`Open ${artist.name}'s page in a new tab`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-hairline)] text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:text-[var(--color-ink-soft-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          </HoverTip>
          </div>
        </div>
      </div>

      {/* Phone-width home for the score bar — full row width, so the name column above keeps
          all of its space for the name. */}
      <div className="-mt-1 px-4 pb-3 sm:hidden">
        <ScoreBreakdown artist={artist} pendingVotes={localVotes} />
      </div>

      {/* Vote receipt + rally share, rendered here by VoteButton — full row width, styled by
          the receipt itself so this stays a zero-height anchor until a vote is cast. */}
      <div ref={setReceiptSlot} />

      {/* Pictures live outside the expanded details: the 📷 button opens them directly. */}
      {picturesMounted && (
        <div
          id={`pictures-panel-${artist.id}`}
          hidden={!picsOpen}
          className="border-t border-[var(--color-hairline)] px-4 py-3 dark:border-[var(--color-hairline-dark)]"
        >
          <RowPicturesPanel artist={artist} />
        </div>
      )}

    </div>
  )
}
