import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentDayIdKST } from './dates'

/** Hearts are one-per-picture but unlimited across pictures, which made them the cheapest
 * counter to farm (most-loved ordering, hero images). A generous daily ceiling stops scripted
 * runs without a real fan ever noticing it exists. */
const DAILY_HEART_LIMIT = 50

export const votePicture = onCall<{ pictureId: string; artistId: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to vote.')

  const { pictureId, artistId } = request.data
  if (!pictureId || !artistId) {
    throw new HttpsError('invalid-argument', 'pictureId and artistId are required.')
  }

  const db = getFirestore()
  const voteRef = db.doc(`pictureVotes/${uid}_${pictureId}`)
  const pictureRef = db.doc(`artists/${artistId}/pictures/${pictureId}`)
  const userRef = db.doc(`users/${uid}`)
  const todayKst = currentDayIdKST()

  const voteCount = await db.runTransaction(async (tx) => {
    const [voteSnap, pictureSnap, userSnap] = await Promise.all([
      tx.get(voteRef),
      tx.get(pictureRef),
      tx.get(userRef),
    ])
    if (voteSnap.exists) throw new HttpsError('already-exists', 'You already voted for this picture.')
    if (!pictureSnap.exists) throw new HttpsError('not-found', 'Picture not found.')

    const userData = userSnap.data() ?? {}
    const heartsToday =
      (userData.pictureHeartsDate as string | undefined) === todayKst
        ? ((userData.pictureHeartsToday as number | undefined) ?? 0)
        : 0
    if (heartsToday >= DAILY_HEART_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Daily picture-heart limit reached — come back tomorrow!')
    }

    tx.set(voteRef, { uid, pictureId, artistId, createdAt: FieldValue.serverTimestamp() })
    tx.update(pictureRef, { voteCount: FieldValue.increment(1) })
    tx.set(userRef, { pictureHeartsToday: heartsToday + 1, pictureHeartsDate: todayKst }, { merge: true })

    return (pictureSnap.data()?.voteCount ?? 0) + 1
  })

  return { voteCount }
})
