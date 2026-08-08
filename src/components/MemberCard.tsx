import type { Member } from '../types'
import { formatBirthdate, zodiacFromDate } from '../lib/zodiac'
import { birthdayStatus, birthdayLabel } from '../lib/birthdays'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

export function MemberCard({ member }: { member: Member }) {
  const zodiac = member.zodiacSign ?? (member.birthdate ? zodiacFromDate(member.birthdate) : null)
  const bday = member.birthdate ? birthdayStatus(member.birthdate) : null
  const bdaySoon = bday && bday.daysUntil <= 30
  const hasBio =
    member.birthdate ||
    zodiac ||
    member.heightCm ||
    member.weightKg ||
    member.interests?.length ||
    member.favoriteFoods?.length ||
    member.favoriteAnimal

  return (
    <div className="rounded-2xl border border-[var(--color-hairline)] p-4 dark:border-[var(--color-hairline-dark)]">
      <h3 className="font-semibold">{member.name}</h3>
      {member.position && (
        <p className="text-xs font-medium text-[var(--color-accent)]">{member.position}</p>
      )}
      {bdaySoon && (
        <p
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            bday.isToday
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink)] dark:bg-[var(--color-surface-sunken-dark)] dark:text-[var(--color-ink-dark)]'
          }`}
        >
          {birthdayLabel(bday)}
        </p>
      )}
      {hasBio ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {member.birthdate && <Field label="Birthdate" value={formatBirthdate(member.birthdate)} />}
          {zodiac && <Field label="Sign" value={zodiac} />}
          {member.heightCm && <Field label="Height" value={`${member.heightCm} cm`} />}
          {member.weightKg && <Field label="Weight" value={`${member.weightKg} kg`} />}
          {member.favoriteAnimal && <Field label="Favorite animal" value={member.favoriteAnimal} />}
          {member.favoriteFoods && member.favoriteFoods.length > 0 && (
            <Field label="Favorite foods" value={member.favoriteFoods.join(', ')} />
          )}
          {member.interests && member.interests.length > 0 && (
            <div className="col-span-2">
              <Field label="Interests" value={member.interests.join(', ')} />
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No bio yet.
        </p>
      )}
    </div>
  )
}
