import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SupportModal } from './SupportModal'

// Support button stays hidden until live Stripe payments are configured
// (VITE_SUPPORT_ENABLED=true), so no non-charging button appears on production.
const SUPPORT_ENABLED = import.meta.env.VITE_SUPPORT_ENABLED === 'true'

export function Footer() {
  const [supportOpen, setSupportOpen] = useState(false)
  const [thanks, setThanks] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('support') === 'thanks') {
      setThanks(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('support')
      window.history.replaceState({}, '', url.toString())
      const t = setTimeout(() => setThanks(false), 6000)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <footer className="mt-12 border-t border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-[var(--color-ink-soft)] sm:flex-row dark:text-[var(--color-ink-soft-dark)]">
        <p>
          PsalmTune — a fan-driven ranking platform for K-pop, C-pop &amp; J-pop. Seed images are CC-licensed
          via Wikimedia Commons.
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link to="/" className="inline-flex min-h-11 items-center hover:underline">
            Home
          </Link>
          <Link to="/fandoms" className="inline-flex min-h-11 items-center hover:underline">
            Fandoms
          </Link>
          <Link to="/hall-of-fame" className="inline-flex min-h-11 items-center hover:underline">
            Hall of Fame
          </Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center hover:underline">
            Privacy
          </Link>
          {SUPPORT_ENABLED && (
            <button
              onClick={() => setSupportOpen(true)}
              className="inline-flex min-h-11 items-center font-semibold text-[var(--color-accent)] hover:underline"
            >
              Support 💜
            </button>
          )}
        </nav>
      </div>

      {thanks && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--color-surface)] shadow-lg dark:bg-[var(--color-ink-dark)] dark:text-[var(--color-surface-dark)]">
          💜 Thank you for supporting PsalmTune!
        </div>
      )}
      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </footer>
  )
}
