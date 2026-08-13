import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/**
 * Handles are the *only* thing that makes a user publicly visible. Claiming one is the
 * consent step: until then no `profiles/{uid}` doc exists and there is nothing to link to.
 *
 * The public projection deliberately never carries `displayName`, `email` or `photoURL`
 * (Google gives us real names — publishing them is a harassment vector), and never any
 * per-artist vote history. Only the chosen handle and aggregate stats.
 */

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/

/** Names that must stay available for routes, staff, or impersonation-proofing. */
const RESERVED_HANDLES = new Set([
  'admin',
  'psalmtune',
  'api',
  'root',
  'support',
  'help',
  'profile',
  'artist',
  'artists',
  'fandom',
  'fandoms',
  'hall-of-fame',
  'login',
  'privacy',
  'stats',
  'official',
  'staff',
  'mod',
])

/**
 * Mirror a user-doc change into the public `profiles/{uid}` projection, inside the same
 * transaction that wrote the user doc. A no-op for users who never claimed a handle —
 * they have no public page, so there is nothing to keep in sync.
 *
 * Pass only the fields the calling transaction actually changed; `updatedAt` is added here.
 */
export function syncPublicProfile(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  uid: string,
  userData: FirebaseFirestore.DocumentData,
  fields: FirebaseFirestore.DocumentData,
): void {
  if (!userData.handle) return
  tx.set(
    db.doc(`profiles/${uid}`),
    { ...fields, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
}

/**
 * Claim a public handle — one per account, and in v1 it can never be changed (a released
 * handle can be re-claimed by someone else and inherit the old owner's inbound links).
 * `handles/{handle}` is the uniqueness lock: the transaction fails if it already exists.
 */
export const claimHandle = onCall<{ handle: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to claim a handle.')

  const raw = request.data?.handle
  if (typeof raw !== 'string') throw new HttpsError('invalid-argument', 'A handle is required.')
  const handle = raw.trim().toLowerCase()

  if (!HANDLE_PATTERN.test(handle)) {
    throw new HttpsError(
      'invalid-argument',
      '3–20 characters, letters, numbers and underscores only.',
    )
  }
  if (RESERVED_HANDLES.has(handle)) {
    throw new HttpsError('invalid-argument', 'That handle is reserved.')
  }

  const db = getFirestore()
  const handleRef = db.doc(`handles/${handle}`)
  const userRef = db.doc(`users/${uid}`)

  await db.runTransaction(async (tx) => {
    const [handleSnap, userSnap] = await Promise.all([tx.get(handleRef), tx.get(userRef)])
    if (handleSnap.exists) throw new HttpsError('already-exists', 'That handle is taken.')

    const userData = userSnap.data() ?? {}
    if (userData.handle) {
      throw new HttpsError('failed-precondition', `You already have the handle @${userData.handle}.`)
    }

    // Denormalize the fandom onto the projection so the public page renders from one read.
    const biasArtistId = (userData.biasArtistId as string | undefined) || null
    let fandomName: string | null = null
    let fandomColorHex: string | null = null
    if (biasArtistId) {
      const artistSnap = await tx.get(db.doc(`artists/${biasArtistId}`))
      fandomName = (artistSnap.data()?.fandomName as string | undefined) ?? null
      fandomColorHex = (artistSnap.data()?.fandomColorHex as string | undefined) ?? null
    }

    tx.set(handleRef, { uid, createdAt: FieldValue.serverTimestamp() })
    tx.set(userRef, { handle }, { merge: true })
    tx.set(db.doc(`profiles/${uid}`), {
      handle,
      biasArtistId,
      fandomName,
      fandomColorHex,
      currentStreak: (userData.currentStreak as number | undefined) ?? 0,
      longestStreak: (userData.longestStreak as number | undefined) ?? 0,
      totalVotes: (userData.totalVotes as number | undefined) ?? 0,
      activeUploadCount: (userData.activeUploadCount as number | undefined) ?? 0,
      joinedAt: userData.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return { handle }
})
