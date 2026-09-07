import { useEffect } from 'react'

interface PageMeta {
  title: string
  description?: string
  /** Canonical/OG path, e.g. "/artist/bts". Defaults to the current pathname. */
  path?: string
  /** Share-card image (absolute URL, or a site-relative path). Falls back to the site
   * default card at /og.png. */
  image?: string
  /** Keep this page out of search results. Hosting rewrites every unknown path to the SPA
   * shell, so a missing artist answers HTTP 200; without this Google indexes those soft 404s
   * as thin duplicates of the homepage. */
  noindex?: boolean
  /** Alt text for the share card. */
  imageAlt?: string
}

const SITE = 'https://psalmtune.com'
const DEFAULT_TITLE = "PsalmTune — fan-voted K-pop, C-pop & J-pop rankings"
const DEFAULT_IMAGE = `${SITE}/og.png`
const DEFAULT_IMAGE_ALT = "PsalmTune — the people's ranking for K-pop, C-pop and J-pop"
/** Tags that only describe the default 1200x630 PNG card. */
const DEFAULT_IMAGE_TAGS = [
  ['og:image:width', '1200'],
  ['og:image:height', '630'],
  ['og:image:type', 'image/png'],
] as const

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Client-side per-route meta. Google renders JS and will pick these up, and it keeps
 * tab titles / in-app share previews correct during SPA navigation. Non-JS social
 * scrapers never run this — they get the prerendered shells written by
 * scripts/prerender.mjs (artist pages, /fandoms, /hall-of-fame) or the static
 * index.html defaults. Keep the two in sync when changing the wording here.
 * Restores the document title on unmount so stale titles don't leak between routes. */
export function usePageMeta({ title, description, path, image, imageAlt, noindex }: PageMeta) {
  useEffect(() => {
    const url = SITE + (path ?? window.location.pathname)
    const custom = Boolean(image)
    const imageUrl = image ? (image.startsWith('http') ? image : SITE + image) : DEFAULT_IMAGE
    document.title = title
    // Soft 404s (unknown artist, unclaimed handle) answer HTTP 200 because Hosting rewrites
    // everything to the SPA shell, so the only way to keep them out of the index is this tag.
    // It has to be removed again on the next route, or one 404 would deindex the whole SPA.
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (noindex) {
      setMeta('meta[name="robots"]', 'name', 'robots', 'noindex')
    } else if (robots) {
      robots.remove()
    }
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
      setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl)
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', imageAlt ?? DEFAULT_IMAGE_ALT)
    setMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', imageAlt ?? DEFAULT_IMAGE_ALT)
    // The static tags advertise the default card's 1200x630 PNG; a page-supplied photo has
    // unknown dimensions and format, so drop the hints rather than lie about them (and
    // restore them when a later route falls back to the default card).
    for (const [key, value] of DEFAULT_IMAGE_TAGS) {
      if (custom) document.head.querySelector(`meta[property="${key}"]`)?.remove()
      else setMeta(`meta[property="${key}"]`, 'property', key, value)
    }
    setCanonical(url)

    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description, path, image, imageAlt, noindex])
}
