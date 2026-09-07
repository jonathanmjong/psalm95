import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { Logo } from './Logo'

export function Header() {
  const { user, loading, signInWithGoogle, logOut } = useAuth()
  const { profile } = useUserProfile()

  return (
    <header className="glass-header sticky top-0 z-50 border-b border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]">
      {/* Everything in this bar is measured against a 390px phone: the brand, two full nav
          labels and the auth control only fit there with the tighter gutter and gaps below.
          `flex-wrap` is the escape hatch for narrower effective widths — at 200% browser zoom
          a phone reports ~195 CSS px, where the auth control used to sit on top of the
          wordmark. Wrapping to a second line costs nothing at normal sizes, since the row
          only wraps once it genuinely cannot fit. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-1 px-4 py-3 sm:flex-nowrap sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-5">
          <Link to="/" className="inline-flex min-h-11 shrink-0 items-center">
            <Logo />
          </Link>
          {/* Visible at every width: the live fandom race is a headline surface, and hiding
              the nav below md left phones with no route to it but the footer. */}
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--color-ink-soft)] sm:gap-4 sm:text-sm dark:text-[var(--color-ink-soft-dark)]">
            <Link
              to="/fandoms"
              className="inline-flex min-h-11 items-center transition hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)]"
            >
              Fandoms
            </Link>
            <Link
              to="/hall-of-fame"
              className="inline-flex min-h-11 items-center whitespace-nowrap transition hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)]"
            >
              Hall of Fame
            </Link>
          </nav>
        </div>
        <nav className="flex shrink-0 items-center gap-2 text-sm sm:gap-4">
          {!loading && user ? (
            <>
              {profile && profile.currentStreak > 0 && (
                <Link
                  to="/profile"
                  title={`${profile.currentStreak}-day streak${
                    profile.streakFreezes > 0 ? ` · ${profile.streakFreezes} streak freeze banked` : ''
                  }`}
                  className="hidden min-h-11 items-center rounded-full bg-[var(--color-surface-sunken)] px-2.5 text-xs font-semibold sm:inline-flex dark:bg-[var(--color-surface-sunken-dark)]"
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
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 transition hover:bg-[var(--color-surface-sunken)] sm:pr-3 dark:hover:bg-[var(--color-surface-sunken-dark)]"
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
              {/* Icon-only on phones, where the words would push the nav labels under the
                  avatar; still a 44px target and still named for screen readers. */}
              <button
                onClick={() => logOut()}
                aria-label="Sign out"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full font-medium transition hover:bg-[var(--color-surface-sunken)] sm:px-3 dark:hover:bg-[var(--color-surface-sunken-dark)]"
              >
                <span className="hidden sm:inline">Sign out</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 sm:hidden"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="btn-gradient inline-flex min-h-11 items-center rounded-full px-4 font-semibold whitespace-nowrap"
            >
              Sign in<span className="hidden sm:inline"> with Google</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
