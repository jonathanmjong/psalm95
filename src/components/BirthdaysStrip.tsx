import { Link } from 'react-router-dom'
import type { Artist } from '../types'
import { upcomingBirthdays } from '../lib/birthdays'

export function BirthdaysStrip({ artists }: { artists: Artist[] }) {
  const upcoming = upcomingBirthdays(artists, 7).slice(0, 12)
  if (upcoming.length === 0) return null

  return (
    <section className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]">
      <h2 className="mb-3 text-sm font-semibold">🎂 Birthdays this week</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {upcoming.map(({ artistId, artistName, member, status }) => (
          <Link
            key={`${artistId}-${member.memberId}`}
            to={`/artist/${artistId}`}
            className={`shrink-0 rounded-xl border px-3 py-2 text-sm transition hover:-translate-y-0.5 ${
              status.isToday
                ? 'border-transparent bg-[var(--color-accent-strong)] text-white'
                : 'border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
            }`}
          >
            <div className="font-semibold">{member.name}</div>
            <div
              className={`text-xs ${status.isToday ? 'text-white/85' : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'}`}
            >
              {artistName} ·{' '}
              {status.isToday ? 'today! 🎉' : status.daysUntil === 1 ? 'tomorrow' : `in ${status.daysUntil} days`}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
