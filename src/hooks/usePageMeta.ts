import { useEffect } from 'react'

interface PageMeta {
  title: string
  description?: string
  /** Canonical/OG path, e.g. "/artist/bts". Defaults to the current pathname. */
  path?: string
}

const SITE = 'https://psalmtune.com'
const DEFAULT_TITLE = "psalm95 — Rank & explore K-pop, C-pop & J-pop artists"

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
 * tab titles / in-app share previews correct. (Non-JS social scrapers still see the
 * static index.html defaults — full per-page previews for those would need prerendering.)
 * Restores the document title on unmount so stale titles don't leak between routes. */
export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const url = SITE + (path ?? window.location.pathname)
    document.title = title
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
      setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setCanonical(url)

    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description, path])
}
