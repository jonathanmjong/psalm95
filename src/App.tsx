import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ToastHost } from './components/ToastHost'
import { ErrorBoundary } from './components/ErrorBoundary'
import { recordVisitOnce } from './lib/visit'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const ArtistPage = lazy(() => import('./pages/ArtistPage').then((m) => ({ default: m.ArtistPage })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const PublicProfile = lazy(() =>
  import('./pages/PublicProfile').then((m) => ({ default: m.PublicProfile })),
)
const Fandoms = lazy(() => import('./pages/Fandoms').then((m) => ({ default: m.Fandoms })))
const HallOfFame = lazy(() => import('./pages/HallOfFame').then((m) => ({ default: m.HallOfFame })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

/** Route chunks are lazy, so a slow connection previously showed a completely blank page —
 *  measured at ~10s on 3G before any affordance appeared. A skeleton says "it's coming". */
function RouteFallback() {
  return (
    <div className="space-y-3 py-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-2/3 animate-pulse rounded-xl bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-[74px] animate-pulse rounded-2xl bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]"
        />
      ))}
    </div>
  )
}

function ScrollToTop() {
  const { pathname, hash, key } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    // Only for forward navigation. On POP (back/forward) the browser restores the previous
    // scroll offset itself, and overriding it dumped people at the top of a board they had
    // scrolled halfway down.
    if (hash || navigationType === 'POP') return
    window.scrollTo(0, 0)
    // Keyed on `key` as well as `pathname`: clicking the logo while already on Home changes
    // neither, and doing nothing nine pages down the board reads as a broken link.
  }, [pathname, hash, key, navigationType])
  return null
}

function App() {
  useEffect(() => {
    // Capture an invite ref (?ref=UID) so it can credit the referrer on first sign-up.
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      localStorage.setItem('psalmtune_ref', ref)
      const url = new URL(window.location.href)
      url.searchParams.delete('ref')
      window.history.replaceState({}, '', url.toString())
    }
    // Which channel sent this visit — aggregate counts only, once per session.
    recordVisitOnce()
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      {/* 15 tab stops (including 10 birthday chips) stood between the top of the page and the
          first ranked row. Visually hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-[var(--color-surface)] focus:px-4 focus:text-sm focus:font-semibold focus:shadow-lg focus:dark:bg-[var(--color-surface-dark)]"
      >
        Skip to rankings
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/artist/:artistId" element={<ArtistPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/u/:handle" element={<PublicProfile />} />
            <Route path="/fandoms" element={<Fandoms />} />
            <Route path="/hall-of-fame" element={<HallOfFame />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <ToastHost />
    </div>
  )
}

export default App
