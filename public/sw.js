/**
 * PsalmTune service worker — hand written, no build-tool plugin.
 *
 * Why it exists: every HTML entry point is served `max-age=0, must-revalidate`, so before
 * this worker an offline reload could not even get a document — the app never started, and
 * the populated Firestore IndexedDB cache underneath it never got a chance to run.
 *
 * Two constants below are rewritten at build time by scripts/generate-sw.mjs. The values
 * checked in are the development placeholders: a copy of this file that never went through
 * the generator precaches nothing, so it degrades to a pure pass-through rather than
 * serving a wrong or empty shell.
 */
const BUILD_ID = 'dev'
const PRECACHE_URLS = []

const CACHE_PREFIX = 'psalmtune-'
const CACHE_NAME = CACHE_PREFIX + BUILD_ID

/** The navigation fallback. `/`, not `/index.html`: Hosting's `cleanUrls` 301s
 *  /index.html -> /, and Cache.put() refuses a redirected response. */
const SHELL_URL = '/'

/** How long a navigation waits for the network before the cached shell takes over. The
 *  document itself is ~5 kB, so exceeding this means the connection is not really there;
 *  the shell then paints from cache and Firestore's local cache fills it in. */
const NAV_TIMEOUT_MS = 3000

/**
 * Same-origin paths this worker may cache. Deliberately an allowlist, so anything not
 * named here — Firestore, googleapis, gstatic, AdSense, Firebase Storage uploads,
 * /sitemap.xml, /robots.txt, /ads.txt — is never intercepted at all. Firestore keeps its
 * own IndexedDB persistence and knows how to invalidate it; a second copy in the Cache API
 * would have no invalidation story and would serve stale votes and ranks forever.
 */
const CACHEABLE_PATH = /^\/assets\/|^\/(favicon\.svg|icon-192\.png|apple-touch-icon\.png)$/

/** Last resort if the precache was evicted under storage pressure and the network is gone.
 *  Normally unreachable — the worker only activates once the shell is cached. */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — PsalmTune</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;font:16px/1.5 system-ui,sans-serif;
background:#faf7fb;color:#1e1b20}main{padding:2rem;text-align:center}</style></head>
<body><main><h1>You're offline</h1><p>PsalmTune will load again once you have a connection.</p>
<p><button onclick="location.reload()">Retry</button></p></main></body></html>`

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          // The shell is the one entry whose URL is not content-hashed, so it must come
          // from the network. The hashed assets may come from the HTTP cache: that exact
          // filename can only ever hold those exact bytes, and the page is downloading
          // most of them at this very moment anyway.
          const response = await fetch(new Request(url, { cache: url === SHELL_URL ? 'reload' : 'default' }))
          if (!response.ok || response.redirected) {
            throw new Error(`precache ${url}: ${response.status}${response.redirected ? ' (redirected)' : ''}`)
          }
          await cache.put(url, response)
        }),
      )
      // Any failure above rejects install, the worker is discarded, and the site behaves
      // exactly as it did before this file existed. A half-filled cache is never activated.
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Firestore, Google APIs, ads, Storage

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }
  if (CACHEABLE_PATH.test(url.pathname)) {
    event.respondWith(cacheFirst(event))
  }
})

/**
 * Navigations are network-first, so a deploy is picked up on the very next reload and an
 * open tab can never be pinned to an old shell. The cached shell is only a fallback — for
 * offline, and for a connection too slow to produce a document within NAV_TIMEOUT_MS.
 *
 * The fallback is always the `/` shell rather than the prerendered per-route HTML
 * (dist/artist/*.html and friends). Those exist for crawlers and social scrapers, which
 * never run a service worker; for a browser the only difference is <head> metadata that
 * usePageMeta rewrites client-side anyway, while the rendered output is identical because
 * the router reads window.location. Caching one shell instead of 111 keeps the cache
 * bounded and keeps their hourly-refreshed rank data from going stale in it.
 */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  const shell = await cache.match(SHELL_URL)
  try {
    return await fetchWithTimeout(request, shell ? NAV_TIMEOUT_MS : 0)
  } catch {
    return shell || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

/** Rejects after `timeoutMs` (0 = wait indefinitely). The losing request is left to finish
 *  rather than aborted: it is a few kB, and racing avoids reconstructing a navigation
 *  Request, whose mode cannot be preserved through the Request constructor. */
function fetchWithTimeout(request, timeoutMs) {
  const network = fetch(request)
  if (!timeoutMs) return network
  network.catch(() => {}) // the race may already have rejected; don't warn twice
  return Promise.race([
    network,
    new Promise((_, reject) => setTimeout(() => reject(new Error('navigation timed out')), timeoutMs)),
  ])
}

/** Content-hashed assets are immutable by construction, so cache-first with no
 *  revalidation is safe: new bytes always arrive under a new filename, and the whole
 *  cache is dropped when BUILD_ID changes. Lazy route chunks that were not precached
 *  (or a chunk added after this build) fall through to the network and join the cache. */
async function cacheFirst(event) {
  const cache = await caches.open(CACHE_NAME)
  // The <head> icons are requested with a ?v=heart buster the precache list has no reason
  // to carry, so match on the path.
  const cached = await cache.match(event.request, { ignoreSearch: true })
  if (cached) return cached

  const response = await fetch(event.request)
  // Only whole, same-origin, successful responses: a 206 range cannot be stored and an
  // opaque cross-origin one would poison the cache with an unreadable body.
  if (response.status === 200 && response.type === 'basic') {
    event.waitUntil(cache.put(event.request, response.clone()))
  }
  return response
}
