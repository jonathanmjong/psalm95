import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/** Credits a referrer when a newly-created user arrived via their invite link.
 * Idempotent: a user can only ever be referred once, and can't refer themselves. */
export const claimReferral = onCall<{ refUid: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.')
  const refUid = request.data.refUid
  if (!refUid || refUid === uid) return { ok: false }

  const db = getFirestore()
  const meRef = db.doc(`users/${uid}`)
  const refRef = db.doc(`users/${refUid}`)

  return db.runTransaction(async (tx) => {
    const [meSnap, refSnap] = await Promise.all([tx.get(meRef), tx.get(refRef)])
    if (!meSnap.exists) throw new HttpsError('failed-precondition', 'Profile not found.')
    if (meSnap.data()?.referredBy) return { ok: false } // already referred
    if (!refSnap.exists) return { ok: false } // referrer isn't a real user

    tx.set(meRef, { referredBy: refUid }, { merge: true })
    tx.set(refRef, { referralCount: FieldValue.increment(1) }, { merge: true })
    return { ok: true }
  })
})
