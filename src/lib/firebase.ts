import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

/**
 * Firestore backed by an IndexedDB local cache, shared across tabs.
 *
 * Every `onSnapshot` listener now replays its last cached snapshot immediately and then
 * delivers the server one, so a repeat visit paints from disk instead of from the network.
 * One-shot `getDoc`/`getDocs` reads stay server-first by design — lib/swr.ts layers
 * cache-then-server on top of those.
 *
 * IndexedDB is missing or blocked in some private-browsing modes and embedded webviews.
 * The SDK degrades to a memory cache on its own for the errors it recognises, but those
 * surface asynchronously; this guard covers the environments where construction itself
 * fails, so the app can never white-screen over a cache.
 */
function createDb(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Memory-only fallback: correct, just without the instant-repeat-visit win.
    return getFirestore(app)
  }
}

export const db = createDb()
export const storage = getStorage(app)
export const functions = getFunctions(app)
export const googleProvider = new GoogleAuthProvider()

/**
 * Local Firebase emulator suite, for end-to-end testing against `firebase emulators:start`.
 *
 * Double-guarded and dev-only: `import.meta.env.DEV` is statically false in a production
 * build, so Rollup drops this whole block from the shipped bundle, and even in dev it stays
 * inert unless `VITE_USE_EMULATORS=true` is set explicitly. There is no way for a deployed
 * build to point itself at localhost.
 */
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8080)
  connectStorageEmulator(storage, host, 9199)
  connectFunctionsEmulator(functions, host, 5001)
  console.info('[firebase] connected to local emulators')
}
