import { onCall } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentDayIdKST } from './dates'

/**
 * Launch attribution: which channel actually sent people, and did they sign up.
 *
 * Deliberately aggregate-only — one counter per source per day, no identifiers, no cookies,
 * nothing per-person. There is no way to reconstruct an individual visit from this data,
 * which is why it needs no consent banner and no third-party script.
 */

/**
 * Sources are mapped onto this fixed list rather than stored verbatim. Map keys taken from
 * user-controlled input grow the document without bound — the same failure mode the
 * weeklyArtistVotes map had — and referrer strings are effectively unbounded.
 */
const KNOWN_SOURCES = [
  'reddit',
  'twitter',
  'x',
  'discord',
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'google',
  'bing',
  'duckduckgo',
  'weverse',
  'weibo',
  'bilibili',
  'naver',
  'daum',
  'tumblr',
  'threads',
  'linkedin',
  'producthunt',
  'hackernews',
  'direct',
] as const

type Source = (typeof KNOWN_SOURCES)[number] | 'other'

/** Folds a referrer host or utm_source into one of the known buckets. */
export function classifySource(raw: string | undefined): Source {
  if (!raw) return 'direct'
  const value = raw.toLowerCase()
  for (const known of KNOWN_SOURCES) {
    if (value.includes(known)) return known
  }
  // Common hosts that don't contain their own bucket name.
  if (value.includes('t.co')) return 'twitter'
  if (value.includes('news.ycombinator')) return 'hackernews'
  if (value.includes('redd.it')) return 'reddit'
  return 'other'
}

/** Landing pages are bucketed by route shape, so artist ids can't explode the map either. */
function classifyLanding(path: string | undefined): string {
  if (!path || path === '/') return 'home'
  if (path.startsWith('/artist/')) return 'artist'
  if (path.startsWith('/u/')) return 'profile'
  if (path.startsWith('/fandoms')) return 'fandoms'
  if (path.startsWith('/hall-of-fame')) return 'hallOfFame'
  return 'other'
}

export const recordVisit = onCall<{ source?: string; landing?: string }>(async (request) => {
  const source = classifySource(request.data?.source)
  const landing = classifyLanding(request.data?.landing)
  const db = getFirestore()

  // Nested objects, not dotted keys: `set` with merge treats "bySource.direct" as a field
  // *named* that, dots and all, while only `update` reads dots as a path. Written the wrong
  // way this silently produced flat keys and every source read back empty. Deep merge plus
  // increment gives the nested shape the reader expects.
  await db.doc(`analytics/${currentDayIdKST()}`).set(
    {
      date: currentDayIdKST(),
      visits: FieldValue.increment(1),
      bySource: { [source]: FieldValue.increment(1) },
      byLanding: { [landing]: FieldValue.increment(1) },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  // Signed-in callers additionally count as an attributed signup on the day they first
  // appear, which is what turns "traffic" into "did that channel actually convert".
  if (request.auth?.uid) {
    const userRef = db.doc(`users/${request.auth.uid}`)
    const snap = await userRef.get()
    if (snap.exists && !snap.data()?.acquisitionSource) {
      await userRef.set({ acquisitionSource: source }, { merge: true })
      await db
        .doc(`analytics/${currentDayIdKST()}`)
        .set({ signupsBySource: { [source]: FieldValue.increment(1) } }, { merge: true })
    }
  }

  return { ok: true }
})
