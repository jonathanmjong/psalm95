interface Props {
  /** Total pages, when the caller knows the roster size. 'Page 3' alone doesn't tell you
   * whether page 7 exists. */
  totalPages?: number
  page: number
  hasMore: boolean
  loading: boolean
  onPrev: () => void
  onNext: () => void
}

export function Pagination({ page, hasMore, loading, onPrev, onNext, totalPages }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 pb-8">
      <button
        onClick={onPrev}
        disabled={page === 0 || loading}
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
      >
        Previous
      </button>
      <span className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Page {page + 1}{totalPages ? ` of ${totalPages}` : ''}
      </span>
      <button
        onClick={onNext}
        disabled={!hasMore || loading}
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
      >
        Next
      </button>
    </div>
  )
}
