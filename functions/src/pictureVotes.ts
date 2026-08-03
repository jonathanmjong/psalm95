import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

  const voteCount = await db.runTransaction(async (tx) => {
    const [voteSnap, pictureSnap] = await Promise.all([tx.get(voteRef), tx.get(pictureRef)])
    if (voteSnap.exists) throw new HttpsError('already-exists', 'You already voted for this picture.')
    if (!pictureSnap.exists) throw new HttpsError('not-found', 'Picture not found.')

    tx.set(voteRef, { uid, pictureId, artistId, createdAt: FieldValue.serverTimestamp() })
    tx.update(pictureRef, { voteCount: FieldValue.increment(1) })

    return (pictureSnap.data()?.voteCount ?? 0) + 1
  })

  return { voteCount }
})
