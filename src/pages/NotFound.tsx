import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

export function NotFound() {
  usePageMeta({ title: 'Page not found | PsalmTune', noindex: true })
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        This artist or page doesn't exist — maybe it moved, or the link's wrong.
      </p>
      <Link
        to="/"
        className="btn-gradient rounded-full px-6 py-2.5 font-semibold"
      >
        Back to rankings
      </Link>
    </div>
  )
}
