import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { ToastHost } from './components/ToastHost'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const ArtistPage = lazy(() => import('./pages/ArtistPage').then((m) => ({ default: m.ArtistPage })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const Fandoms = lazy(() => import('./pages/Fandoms').then((m) => ({ default: m.Fandoms })))
const HallOfFame = lazy(() => import('./pages/HallOfFame').then((m) => ({ default: m.HallOfFame })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

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
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/artist/:artistId" element={<ArtistPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/profile" element={<Profile />} />
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
