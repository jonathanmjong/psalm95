import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--color-ink-soft)] sm:flex-row dark:text-[var(--color-ink-soft-dark)]">
        <p>
          psalm95 — a fan-driven ranking platform for K-pop, C-pop &amp; J-pop. Seed images are CC-licensed
          via Wikimedia Commons.
        </p>
        <nav className="flex items-center gap-4">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
