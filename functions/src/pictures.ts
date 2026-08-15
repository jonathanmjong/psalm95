import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { syncPublicProfile } from './handles'

const MAX_ACTIVE_UPLOADS = 3

interface TaggedMember {
  artistId: string
  memberId: string
}

interface CreatePictureData {
  artistId: string
  storagePath: string
  taggedMembers?: TaggedMember[]
  /** Who took the photo, as typed by the uploader. Fansite photographers are protective of
   * their work, and an uncredited repost is a reliable way for a fan site to get piled on. */
  credit?: string
}

function publicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`
}

export const createPictureDoc = onCall<CreatePictureData>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to upload.')

  const { artistId, storagePath, taggedMembers = [], credit } = request.data
  const creditText = typeof credit === 'string' ? credit.trim().slice(0, 120) : ''
  if (!artistId || !storagePath || !storagePath.includes(`/uploads/${uid}/`)) {
    throw new HttpsError('invalid-argument', 'Invalid upload payload.')
  }

  const db = getFirestore()
  const bucket = getStorage().bucket()
  const userRef = db.doc(`users/${uid}`)
  const pictureRef = db.collection(`artists/${artistId}/pictures`).doc()

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      const userData = userSnap.data() ?? {}
      const activeUploadCount = userData.activeUploadCount ?? 0
      if (activeUploadCount >= MAX_ACTIVE_UPLOADS) {
        throw new HttpsError('resource-exhausted', 'You already have 3 active uploads. Delete one first.')
      }

      tx.set(
        pictureRef,
        {
          artistId,
          storagePath,
          url: publicUrl(bucket.name, storagePath),
          uploadedBy: uid,
          uploadedAt: FieldValue.serverTimestamp(),
          taggedArtists: [artistId],
          taggedMembers,
          taggedMemberKeys: taggedMembers.map((m) => `${m.artistId}_${m.memberId}`),
          source: 'user-upload',
          ...(creditText ? { attribution: { author: creditText, license: 'Credited by uploader' } } : {}),
          voteCount: 0,
        },
        { merge: true },
      )
      tx.set(userRef, { activeUploadCount: FieldValue.increment(1) }, { merge: true })
      // Public projection (handle-holders only) — drives the Photographer badge.
      syncPublicProfile(tx, db, uid, userData, { activeUploadCount: FieldValue.increment(1) })
    })
  } catch (err) {
    // Clean up the just-uploaded Storage object if we're rejecting the doc creation.
    await bucket.file(storagePath).delete({ ignoreNotFound: true })
    throw err
  }

  return { pictureId: pictureRef.id }
})

export const deletePicture = onCall<{ artistId: string; pictureId: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')

  const { artistId, pictureId } = request.data
  if (!artistId || !pictureId) {
    throw new HttpsError('invalid-argument', 'artistId and pictureId are required.')
  }

  const db = getFirestore()
  const pictureRef = db.doc(`artists/${artistId}/pictures/${pictureId}`)
  const userRef = db.doc(`users/${uid}`)

  const storagePath = await db.runTransaction(async (tx) => {
    const [pictureSnap, userSnap] = await Promise.all([tx.get(pictureRef), tx.get(userRef)])
    if (!pictureSnap.exists) throw new HttpsError('not-found', 'Picture not found.')
    const data = pictureSnap.data()!
    if (data.uploadedBy !== uid) throw new HttpsError('permission-denied', 'Not your upload.')

    tx.delete(pictureRef)
    tx.set(userRef, { activeUploadCount: FieldValue.increment(-1) }, { merge: true })
    syncPublicProfile(tx, db, uid, userSnap.data() ?? {}, {
      activeUploadCount: FieldValue.increment(-1),
    })
    return data.storagePath as string | null
  })

  if (storagePath) {
    await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true })
  }

  return { ok: true }
})
