import { useGenerations } from '../hooks/useGenerations'

interface Props {
  value: string | null
  onChange: (generationId: string | null) => void
}

export function GenerationFilter({ value, onChange }: Props) {
  const { generations } = useGenerations()

  return (
    <select
      value={value ?? 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
      className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
    >
      <option value="all">All generations</option>
      {generations.map((gen) => (
        <option key={gen.id} value={gen.id}>
          {gen.label}
        </option>
      ))}
    </select>
  )
}
