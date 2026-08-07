const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

/** Injects the Google AdSense loader script once, only if a publisher id is configured.
 * No-op (and zero third-party requests / cookies) until VITE_ADSENSE_CLIENT is set, so
 * nothing loads before the AdSense account is approved. */
export function loadAdSense() {
  if (!ADSENSE_CLIENT) return
  if (document.querySelector('script[data-adsense]')) return
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  s.crossOrigin = 'anonymous'
  s.setAttribute('data-adsense', 'true')
  document.head.appendChild(s)
}
