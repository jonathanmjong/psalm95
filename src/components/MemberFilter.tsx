import type { Member } from '../types'

interface Props {
  members: Member[]
  value: string | null
  onChange: (memberId: string | null) => void
}

export function MemberFilter({ members, value, onChange }: Props) {
  if (members.length <= 1) return null

  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
      className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
    >
      <option value="all">All members</option>
      {members.map((member) => (
        <option key={member.memberId} value={member.memberId}>
          {member.name}
        </option>
      ))}
    </select>
  )
}
