import type { PictureSort } from '../hooks/useArtistPictures'

interface Props {
  value: PictureSort
  onChange: (sort: PictureSort) => void
}

export function SortControl({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full border border-[var(--color-hairline)] p-0.5 text-sm dark:border-[var(--color-hairline-dark)]">
      {(['date', 'votes'] as const).map((sort) => (
        <button
          key={sort}
          onClick={() => onChange(sort)}
          className={`rounded-full px-3 py-1.5 font-medium transition ${
            value === sort
              ? 'bg-[var(--color-accent-strong)] text-white'
              : 'text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]'
          }`}
        >
          {sort === 'date' ? 'Newest' : 'Most voted'}
        </button>
      ))}
    </div>
  )
}
