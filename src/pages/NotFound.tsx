import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        This artist or page doesn't exist — maybe it moved, or the link's wrong.
      </p>
      <Link
        to="/"
        className="rounded-full bg-[var(--color-accent)] px-6 py-2.5 font-medium text-white transition hover:opacity-90"
      >
        Back to rankings
      </Link>
    </div>
  )
}
