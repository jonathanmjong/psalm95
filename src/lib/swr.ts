import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore'

/**
 * Stale-while-revalidate for Firestore's one-shot reads.
 *
 * `onSnapshot` listeners get this for free once the persistent local cache is on
 * (see lib/firebase.ts): they replay the last cached snapshot before the server answers.
 * `getDoc`/`getDocs` do not — they always wait for the server, so they still block first
 * paint on a repeat visit. These helpers read the local cache first, hand the cached value
 * over immediately, and then deliver the server value through the same callback.
 */

export interface SwrOptions {
  /**
   * Skip the cache-first delivery and read straight from the server. Set this for any read
   * that follows a mutation — a bumped `refreshKey`, an explicit `refresh()` — where the
   * local cache can still hold the pre-mutation value and showing it would look like the
   * change reverted.
   */
  serverOnly?: boolean
}

/**
 * Receives each delivery of an SWR read. On a cache hit it is called twice — once with the
 * cached value (`fromCache: true`), then once with the server value — so it MUST be
 * idempotent: write the same state, the same way, both times.
 */
export type SwrDeliver<T> = (value: T, fromCache: boolean) => void

async function swrRead<S, T>(
  readCache: () => Promise<S>,
  readServer: () => Promise<S>,
  hasContent: (snap: S) => boolean,
  map: (snap: S) => T | Promise<T>,
  deliver: SwrDeliver<T>,
  { serverOnly = false }: SwrOptions,
): Promise<T> {
  let cached: T | undefined
  let deliveredFromCache = false

  if (!serverOnly) {
    try {
      const snap = await readCache()
      // An empty cache result is indistinguishable from "this was never cached", so treat
      // it as a miss instead of flashing an empty state before the server has answered.
      if (hasContent(snap)) {
        cached = await map(snap)
        deliveredFromCache = true
        deliver(cached, true)
      }
    } catch {
      // Cache miss, or no persistence at all — fall through to the server read.
    }
  }

  try {
    const fresh = await map(await readServer())
    deliver(fresh, false)
    return fresh
  } catch (err) {
    // Offline with something already on screen is a success, not a failure.
    if (deliveredFromCache) return cached as T
    throw err
  }
}

/** Cache-then-server read of a single document. */
export function swrDoc<T>(
  ref: DocumentReference,
  map: (snap: DocumentSnapshot) => T | Promise<T>,
  deliver: SwrDeliver<T>,
  options: SwrOptions = {},
): Promise<T> {
  return swrRead(
    () => getDocFromCache(ref),
    () => getDoc(ref),
    (snap) => snap.exists(),
    map,
    deliver,
    options,
  )
}

/** Cache-then-server read of a query. */
export function swrQuery<T>(
  q: Query,
  map: (snap: QuerySnapshot) => T | Promise<T>,
  deliver: SwrDeliver<T>,
  options: SwrOptions = {},
): Promise<T> {
  return swrRead(
    () => getDocsFromCache(q),
    () => getDocs(q),
    (snap) => !snap.empty,
    map,
    deliver,
    options,
  )
}

/**
 * A module-level SWR resource: one in-flight read per session (so N mounting components
 * share a single fetch), plus the newest delivered value kept in memory so a re-mount can
 * paint synchronously instead of waiting even for the cache read.
 *
 * `fetcher` receives the deliver callback to pass to `swrDoc`/`swrQuery`; it will be called
 * once per session and must resolve with the fresh value.
 */
export interface SwrResource<T> {
  /** The newest delivered value, or undefined before the first delivery. */
  peek(): T | undefined
  /** Listen for every later delivery (cached and fresh). Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void
  /** Starts — or joins — this session's read. Resolves with the fresh server value. */
  load(): Promise<T>
}

export function createSwrResource<T>(
  fetcher: (deliver: (value: T) => void) => Promise<T>,
): SwrResource<T> {
  let inflight: Promise<T> | null = null
  let latest: T | undefined
  const listeners = new Set<(value: T) => void>()

  const deliver = (value: T) => {
    latest = value
    for (const listener of listeners) listener(value)
  }

  return {
    peek: () => latest,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load() {
      if (!inflight) {
        inflight = fetcher(deliver).catch((err: unknown) => {
          inflight = null // allow a retry on failure
          throw err
        })
      }
      return inflight
    },
  }
}
