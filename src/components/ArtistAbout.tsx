import type { Artist } from '../types'
import { MemberCard } from './MemberCard'

export function ArtistAbout({ artist }: { artist: Artist }) {
  return (
    <section className="space-y-4">
      {(artist.agency || (artist.influences && artist.influences.length > 0)) && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {artist.agency && (
            <p>
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">Agency: </span>
              {artist.agency}
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
        {artist.members.map((member) => (
          <MemberCard key={member.memberId} member={member} />
        ))}
      </div>
    </section>
  )
}
