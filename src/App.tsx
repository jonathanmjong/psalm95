import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ToastHost } from './components/ToastHost'

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
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

/** BrowserRouter keeps the scroll offset across navigations, so opening an artist from
 * halfway down the board dropped you into the middle of their page. Reset on every path
 * change (a hash still gets to do its own thing). */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])
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
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/artist/:artistId" element={<ArtistPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/u/:handle" element={<PublicProfile />} />
            <Route path="/fandoms" element={<Fandoms />} />
            <Route path="/hall-of-fame" element={<HallOfFame />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ToastHost />
    </div>
  )
}

export default App
