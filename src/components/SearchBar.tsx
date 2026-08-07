interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="relative w-full">
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search artists or members…"
        aria-label="Search artists or members"
        className="w-full rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] py-2.5 pl-11 pr-10 text-sm outline-none transition focus:border-[var(--color-accent)] dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-ink-soft)] transition hover:bg-[var(--color-surface-sunken)] dark:text-[var(--color-ink-soft-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
        >
          ✕
        </button>
      )}
    </div>
  )
}
