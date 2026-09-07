import type { Artist } from '../types'
import { MemberCard } from './MemberCard'
import { formatBirthdate } from '../lib/zodiac'
import { useMemberPhotos } from '../hooks/useMemberPhotos'

export function ArtistAbout({ artist }: { artist: Artist }) {
  const { byMember } = useMemberPhotos(artist.id, artist)
  const hasFacts =
    artist.debutDate || artist.agency || artist.fandomName || (artist.influences && artist.influences.length > 0)

  return (
    <section className="space-y-4">
      {hasFacts && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          {artist.debutDate && (
            <p>
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">Debuted: </span>
              {formatBirthdate(artist.debutDate)}
            </p>
          )}
          {artist.agency && (
            <p>
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">Agency: </span>
              {artist.agency}
            </p>
          )}
          {artist.fandomName && (
            <p className="inline-flex items-center gap-1.5">
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">Fandom: </span>
              {artist.fandomColorHex && (
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-[var(--color-hairline)] dark:ring-[var(--color-hairline-dark)]"
                  style={{ backgroundColor: artist.fandomColorHex }}
                  aria-hidden
                />
              )}
              {artist.fandomName}
              {artist.fandomColorName && (
                <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                  ({artist.fandomColorName})
                </span>
              )}
            </p>
          )}
          {artist.influences && artist.influences.length > 0 && (
            <p>
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                Influences:{' '}
              </span>
              {artist.influences.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Only a photo the member is individually tagged in is ever used as their portrait.
            There is deliberately no group-photo fallback: rotating through the artist's top
            pictures put album art and four-person group shots on individual members' cards,
            which reads as a fake site. MemberCard's gradient initial is the honest fallback. */}
        {artist.members.map((member) => (
          <MemberCard key={member.memberId} member={member} photoUrl={byMember[member.memberId]} />
        ))}
      </div>
    </section>
  )
}
