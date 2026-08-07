import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { loadAdSense } from './lib/adsense'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const ArtistPage = lazy(() => import('./pages/ArtistPage').then((m) => ({ default: m.ArtistPage })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

function App() {
  useEffect(() => {
    loadAdSense()
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
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
