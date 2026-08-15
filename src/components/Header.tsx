import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { Logo } from './Logo'

export function Header() {
  const { user, loading, signInWithGoogle, logOut } = useAuth()
  const { profile } = useUserProfile()

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          {/* Visible at every width: the live fandom race is a headline surface, and hiding
              the nav below md left phones with no route to it but the footer. */}
          <nav className="flex items-center gap-3 text-xs font-medium text-[var(--color-ink-soft)] sm:gap-4 sm:text-sm dark:text-[var(--color-ink-soft-dark)]">
            <Link to="/fandoms" className="transition hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)]">
              Fandoms
            </Link>
            <Link
              to="/hall-of-fame"
              className="whitespace-nowrap transition hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)]"
            >
              Hall<span className="hidden sm:inline"> of Fame</span>
            </Link>
          </nav>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {!loading && user ? (
            <>
              {profile && profile.currentStreak > 0 && (
                <Link
                  to="/profile"
                  title={`${profile.currentStreak}-day streak${
                    profile.streakFreezes > 0 ? ` · ${profile.streakFreezes} streak freeze banked` : ''
                  }`}
                  className="hidden rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-xs font-semibold sm:inline dark:bg-[var(--color-surface-sunken-dark)]"
                >
                  🔥 {profile.currentStreak}
                  {profile.streakFreezes > 0 && (
                    <span className="ml-1 text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                      ❄️{profile.streakFreezes}
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
                )}
                <span className="hidden text-[var(--color-ink-soft)] sm:inline dark:text-[var(--color-ink-soft-dark)]">
                  {user.displayName}
                </span>
              </Link>
              <button
                onClick={() => logOut()}
                className="inline-flex min-h-11 items-center rounded-full px-3 font-medium transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="btn-gradient rounded-full px-4 py-1.5 font-semibold"
            >
              Sign in with Google
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
