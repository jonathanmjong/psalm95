import type { ArtistPicture } from '../types'
import { sized, sizedSrcSet } from '../lib/images'

interface Props {
  pictures: ArtistPicture[]
  artistName: string
  onOpen: (picture: ArtistPicture) => void
  showVotes?: boolean
}

/** A horizontally scrollable row of picture thumbnails. Each opens the lightbox. */
export function PictureStrip({ pictures, artistName, onOpen, showVotes = false }: Props) {
  if (pictures.length === 0) return null

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {pictures.map((pic) => (
        <button
          key={pic.id}
          onClick={() => onOpen(pic)}
          className="lift group relative aspect-square w-28 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]"
          aria-label={`Open ${artistName} picture`}
        >
          <img
            src={sized(pic.url, 250)}
            srcSet={sizedSrcSet(pic.url, 250, 500)}
            sizes="112px"
            width={112}
            height={112}
            alt={`${artistName} fan photo`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          {showVotes && pic.voteCount > 0 && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {pic.voteCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
