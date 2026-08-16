/**
 * Registers public/sw.js, which precaches the app shell so a reload works offline and a
 * repeat visit paints without waiting for the network.
 *
 * Production only. In dev, Vite serves modules unbundled over HMR and a worker holding
 * cached copies of them would fight every save; `import.meta.env.PROD` is a static false
 * there, so Rollup drops this whole body from the dev bundle.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // After `load`: installing precaches ~1 MB, and starting that while the page is still
  // fetching its own chunks would slow down exactly the connections this is meant to help.
  window.addEventListener('load', () => {
    // Tracks whether this page was already under a worker's control. It has to be a
    // mutable flag, not a constant read once: on a first-ever visit the page starts
    // uncontrolled and gets claimed moments later, and a constant captured here would
    // still say "uncontrolled" at the *next* controllerchange — the one that actually
    // signals a new build — and swallow the reload that change exists for.
    let wasControlled = Boolean(navigator.serviceWorker.controller)
    let reloading = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const firstClaim = !wasControlled
      wasControlled = true
      // The first claim is this build's own worker taking over a page that is already
      // showing this build; reloading for it would be a pointless flash.
      if (firstClaim || reloading) return
      // Any later change means a newer build installed while this tab was open, and
      // activating it wiped the previous build's cache. This tab is still running that
      // build's JS, whose not-yet-imported lazy route chunks no longer exist in the cache
      // or on Hosting (a deploy deletes them), so it is one navigation away from a broken
      // import. Reload onto the new build now instead of failing later.
      reloading = true
      window.location.reload()
    })

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Private browsing, blocked storage, an unsupported browser: the site works without
      // a worker, so there is nothing here worth surfacing to the user.
    })
  })
}
