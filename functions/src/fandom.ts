import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/** Join (or switch, or leave) a fandom. Keeps fandomStats member counts in sync — the
 * only writer of users/{uid}.biasArtistId, so counts can't be gamed by direct client writes. */
export const joinFandom = onCall<{ artistId: string | null }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.')
  const artistId = request.data?.artistId || null

  const db = getFirestore()
  const meRef = db.doc(`users/${uid}`)

  return db.runTransaction(async (tx) => {
    const meSnap = await tx.get(meRef)
    const prev = (meSnap.data()?.biasArtistId as string | undefined) || null

    // Validate the target artist exists (skip for "leave").
    if (artistId) {
      const artistSnap = await tx.get(db.doc(`artists/${artistId}`))
      if (!artistSnap.exists) throw new HttpsError('not-found', 'Artist not found.')
    }
    if (prev === artistId) return { ok: true, biasArtistId: artistId }

    tx.set(meRef, { biasArtistId: artistId }, { merge: true })
    if (prev) tx.set(db.doc(`fandomStats/${prev}`), { memberCount: FieldValue.increment(-1) }, { merge: true })
    if (artistId)
      tx.set(db.doc(`fandomStats/${artistId}`), { memberCount: FieldValue.increment(1) }, { merge: true })

    return { ok: true, biasArtistId: artistId }
  })
})
