import { resolveArtistEntity } from '../../seed/wikimedia'
import type { MetricArtist, MetricProvider } from '../types'

/**
 * Popularity from Wikipedia pageviews.
 *
 * Why this exists: the previous chain (Spotify -> Deezer -> Last.fm) effectively degraded to
 * Deezer alone — Spotify's `artists` endpoint no longer returns `popularity` without Extended
 * Quota Mode, and the stored Last.fm key is not a valid key. Deezer's `nb_fan` is a lifetime
 * follower total on a catalog with a legacy/Western-adjacent skew, so it ranked disbanded acts
 * above current ones (2NE1, disbanded 2016: 403,912 fans vs NewJeans: 345,582). Pageviews are a
 * *current attention* signal and put those the right way round.
 *
 * How it works:
 *   1. The artist is resolved to a verified Wikidata entity by `resolveArtistEntity` — the same
 *      identity gate the photo seeder uses (label/alias match + musical-type check + country
 *      score). Article titles are then read from that entity's `sitelinks`, never guessed from
 *      the artist's name. Guessing is what breaks this metric: `IVE` is a disambiguation page
 *      (159 views/30d) while the real article is `Ive_(group)` (35,446), and `Twice_(group)` is
 *      a stub next to `Twice`.
 *   2. Daily pageviews over the last complete 30-day window are summed across the English wiki
 *      plus the artist's regional wiki (ko/ja/zh), the latter scaled by LOCAL_WIKI_WEIGHT. Read
 *      that constant's comment before trusting the board: the local wikis are used very
 *      unevenly across regions and it is the single knob that decides how the board looks.
 *   3. The resolved titles are handed back on `patch.wikiArticles` so `runMetrics` can store them
 *      on the artist doc; later runs read the cache and skip the Wikidata round trips entirely.
 *
 * Never throws — one unresolvable artist must not fail the batch; it reports stale and the
 * caller falls through to Deezer.
 */

const PAGEVIEWS_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article'

/** Wikimedia requires a descriptive User-Agent identifying the client and a contact. */
const USER_AGENT = 'psalm95-ranking-bot/1.0 (https://psalmtune.com; jonathanmjong@gmail.com)'

/** Length of the summed window, in days. */
const WINDOW_DAYS = 30

/**
 * How far back the window ends. The pageviews dumps land 2-3 days behind UTC "today", so a
 * window ending yesterday would silently be short a few days. Every artist is measured over the
 * exact same calendar window, so a lag change shifts all values together and never reorders them.
 */
const LAG_DAYS = 3

/**
 * Minimum spacing between requests to Wikimedia. Their guidance is ~100 req/s; this is ~7 req/s,
 * deliberately far more conservative for an unattended job that sweeps the whole roster every
 * 6 hours. The gate is module-global, so raising the per-artist concurrency in `runMetrics`
 * does not raise the request rate.
 */
const MIN_REQUEST_INTERVAL_MS = 150

/** region -> the local-language wiki that carries meaningful traffic for that scene. */
const REGION_LANGUAGE: Record<string, string> = { KR: 'ko', JP: 'ja', CN: 'zh' }

/**
 * How much the local-language article counts for, relative to the English one.
 *
 * 1 = straight sum. THIS IS THE ONE NUMBER TO REVISIT — the local wikis are not comparably
 * used, and the asymmetry is large. Measured over the live roster (30d to 2026-08-14, median
 * local-wiki share of each artist's total):
 *
 *     JP artists  92%      KR artists  8%      CN artists  73%
 *
 * Korean readers largely use Namu Wiki rather than ko.wikipedia, while ja.wikipedia is a
 * mainstream domestic reference. So a straight sum hands J-pop and C-pop acts a multiplier that
 * K-pop acts do not get: at 1 the top 20 comes out 10 J-pop / 8 K-pop / 2 C-pop, with Snow Man
 * at #2 above Blackpink and SixTONES at #5 above NewJeans. At 0 (English article only, the same
 * roster measured the same day) it is 16 K-pop / 3 J-pop / 1 C-pop and the top of the board is
 * BTS, Blackpink, Stray Kids, NewJeans.
 *
 * Both boards fix the bugs this provider was written for (NewJeans over 2NE1, IVE over Rainbow);
 * they differ on how much weight a domestic-language audience should carry, which is a product
 * call, not a technical one. Changing this constant is the whole switch.
 */
const LOCAL_WIKI_WEIGHT = 1

/** Article titles per language code, cached on the artist doc as `wikiArticles`. */
export type WikiArticles = Record<string, string>

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let nextRequestAt = 0

/** Serializes request starts onto a global schedule. Safe under concurrent callers: the
 * read-modify-write of `nextRequestAt` happens synchronously before any await. */
async function throttle() {
  const now = Date.now()
  const slot = Math.max(now, nextRequestAt)
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS
  if (slot > now) await sleep(slot - now)
}

/** `YYYYMMDD` for `daysAgo` days before now, in UTC (the API's timezone). */
function utcStamp(daysAgo: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/** The `[start, end]` `YYYYMMDD` pair every artist is measured over on this run. */
export function pageviewWindow(): { start: string; end: string } {
  return { start: utcStamp(LAG_DAYS + WINDOW_DAYS - 1), end: utcStamp(LAG_DAYS) }
}

interface PageviewsResponse {
  items?: { views: number }[]
}

/**
 * Summed daily views for one article over the window.
 * Returns `null` when the request could not be completed (network/5xx/429 after retries) so a
 * transient failure is distinguishable from a genuinely unread article; 404 means the API has
 * no record for that title, which is a real answer of zero.
 */
export async function articleViews(
  language: string,
  title: string,
  start: string,
  end: string,
): Promise<number | null> {
  const url =
    `${PAGEVIEWS_API}/${language}.wikipedia/all-access/user/` +
    `${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${start}/${end}`

  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      if (res.status === 404) return 0
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 2
        await sleep(retryAfter * 1000)
        continue
      }
      if (!res.ok) return null
      const json = (await res.json()) as PageviewsResponse
      // Days with zero views are omitted from `items` rather than returned as 0, so a plain sum
      // over whatever came back is already the window total.
      return (json.items ?? []).reduce((sum, item) => sum + (item.views ?? 0), 0)
    } catch {
      await sleep(500)
    }
  }
  return null
}

/**
 * Article titles for an artist, from the cache on the doc when present, otherwise by resolving
 * the Wikidata entity. Returns `{}` when the entity cannot be verified — better no number than a
 * number belonging to a disambiguation page or the wrong band.
 *
 * A failed resolution is deliberately NOT cached: it is a handful of artists, the job reruns
 * every 6 hours, and caching the failure would freeze out an artist whose Wikidata entry later
 * improves.
 */
export async function resolveWikiArticles(artist: MetricArtist): Promise<{ articles: WikiArticles; cached: boolean }> {
  const cached = artist.wikiArticles
  if (cached && Object.keys(cached).length > 0) return { articles: cached, cached: true }

  const resolved = await resolveArtistEntity({
    id: artist.id,
    name: artist.name,
    region: artist.region,
    type: artist.type,
    spotifyArtistId: artist.spotifyArtistId ?? null,
  })
  if (!resolved) return { articles: {}, cached: false }

  const languages = ['en', REGION_LANGUAGE[artist.region ?? ''] ?? 'en']
  const articles: WikiArticles = {}
  for (const language of new Set(languages)) {
    const title = resolved.wd.sitelinks?.[`${language}wiki`]?.title
    if (title) articles[language] = title
  }
  return { articles, cached: false }
}

export const wikipediaPopularityProvider: MetricProvider = {
  id: 'wikipedia-pageviews',
  async fetch(artist) {
    try {
      const { articles, cached } = await resolveWikiArticles(artist)
      const languages = Object.keys(articles)
      if (languages.length === 0) return { value: 0, stale: true }

      const { start, end } = pageviewWindow()

      let total = 0
      let answered = 0
      for (const language of languages) {
        const views = await articleViews(language, articles[language], start, end)
        if (views === null) continue
        answered++
        total += language === 'en' ? views : views * LOCAL_WIKI_WEIGHT
      }
      total = Math.round(total)

      // No wiki answered at all, or the artist genuinely draws no readers: neither is a usable
      // popularity signal, so fall through to the next provider in the chain.
      if (answered === 0 || total <= 0) return { value: 0, stale: true }

      // Only worth a write when the titles weren't already on the doc.
      return { value: total, stale: false, ...(cached ? {} : { patch: { wikiArticles: articles } }) }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
