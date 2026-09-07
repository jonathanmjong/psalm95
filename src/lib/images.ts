/**
 * Wikimedia serves the *originals* our seeder recorded — routinely 2–3 MB each. A ranking
 * page renders up to ~70 of them, so rendering originals meant tens of megabytes per visit.
 * Commons exposes a resized copy at a predictable path, and a 2.5 MB concert photo comes
 * back as ~2 KB at avatar size, so every <img> asks for roughly the size it displays.
 *
 *   original: /wikipedia/commons/e/e8/File.jpg
 *   thumb:    /wikipedia/commons/thumb/e/e8/File.jpg/160px-File.jpg
 *
 * Anything we can't rewrite (user uploads in Firebase Storage, unknown hosts) is returned
 * untouched — the caller always gets a usable URL.
 */

const WIKIMEDIA_HOST = 'upload.wikimedia.org'

/**
 * Commons rejects arbitrary widths with a 400 ("Use thumbnail sizes listed on…") — only a
 * fixed set renders. These four are verified to work across files; anything else silently
 * becomes a 2 KB error page in place of the photo, so the type keeps callers honest.
 */
export type ImageWidth = 120 | 250 | 500 | 1280
const ALLOWED: readonly number[] = [120, 250, 500, 1280]

/**
 * A same-image URL sized for display. `width` is the *rendered* CSS width times the pixel
 * ratio you want to support — pass 96 for a 48px avatar, 1280 for a lightbox.
 */
export function sized(url: string | undefined, width: ImageWidth): string | undefined {
  if (!url) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (parsed.hostname !== WIKIMEDIA_HOST) return url
  // Defence in depth for JS callers the type can't reach: snap up to a renderable size.
  const w = ALLOWED.includes(width) ? width : (ALLOWED.find((a) => a >= width) ?? 1280)

  // Query strings (the seeder appends utm_* params) aren't part of the file path.
  const path = parsed.pathname
  if (path.includes('/thumb/')) return url // already a thumbnail

  // /wikipedia/{project}/{a}/{ab}/{file} — anything else isn't a file path we understand.
  const parts = path.split('/').filter(Boolean)
  if (parts.length < 5 || parts[0] !== 'wikipedia') return url

  const file = parts[parts.length - 1]
  // Commons renders SVGs to PNG at a given width; every other type keeps its extension.
  const rendered = file.toLowerCase().endsWith('.svg') ? `${file}.png` : file
  const prefix = parts.slice(0, 2).join('/')
  const dirs = parts.slice(2, parts.length - 1).join('/')

  return `${parsed.origin}/${prefix}/thumb/${dirs}/${file}/${w}px-${rendered}`
}

/**
 * `srcSet` for a 1x/2x pair, so high-density screens get a sharper copy without every
 * screen paying for it.
 */
export function sizedSrcSet(
  url: string | undefined,
  width: ImageWidth,
  retina: ImageWidth,
): string | undefined {
  if (!url) return undefined
  const one = sized(url, width)
  const two = sized(url, retina)
  if (!one || !two || one === two) return undefined
  return `${one} 1x, ${two} 2x`
}
