import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from './Logo'

export function Header() {
  const { user, loading, signInWithGoogle, logOut } = useAuth()

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {!loading && user ? (
            <>
              <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                {user.displayName}
              </span>
              <button
                onClick={() => logOut()}
                className="rounded-full px-4 py-1.5 font-medium transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 font-medium text-white transition hover:opacity-90"
            >
              Sign in with Google
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
