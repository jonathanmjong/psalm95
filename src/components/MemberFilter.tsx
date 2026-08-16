import type { Member } from '../types'

interface Props {
  members: Member[]
  /**
   * Ids of the members who actually have at least one tagged photo. Any other member is a
   * dead option: picking them can only ever produce the empty-gallery message.
   */
  taggedMemberIds: ReadonlySet<string>
  value: string | null
  onChange: (memberId: string | null) => void
}

export function MemberFilter({ members, taggedMemberIds, value, onChange }: Props) {
  // Solo artists have nothing to filter by, and a member with no tagged photo is a trap —
  // every one of the 7 BTS options returned "No pictures yet" because nothing carries
  // `taggedMemberKeys`. With no filterable member left, the control itself is the dead end,
  // so it doesn't render at all.
  if (members.length <= 1) return null
  const options = members.filter((m) => taggedMemberIds.has(m.memberId))
  if (options.length === 0) return null

  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
      aria-label="Filter pictures by member"
      className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
    >
      <option value="all">All members</option>
      {options.map((member) => (
        <option key={member.memberId} value={member.memberId}>
          {member.name}
        </option>
      ))}
    </select>
  )
}
