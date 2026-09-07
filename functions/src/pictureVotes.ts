import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentDayIdKST } from './dates'

/** Hearts are one-per-picture but unlimited across pictures, which made them the cheapest
 * counter to farm (most-loved ordering, hero images). A generous daily ceiling stops scripted
 * runs without a real fan ever noticing it exists. */
const DAILY_HEART_LIMIT = 50

/** Hearts pick an artist's best photos — the most-hearted one becomes their picture across the
 * site — so they are a curation choice, not a tally. Three per artist forces that choice to
 * mean something while leaving every *other* artist's three untouched. Deliberately never
 * reset: unlike the weekly artist vote, this is a considered "these are their best" pick. */
const PICTURE_VOTES_PER_ARTIST = 3

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

  return await db.runTransaction(async (tx) => {
    const [voteSnap, pictureSnap, userSnap] = await Promise.all([
      tx.get(voteRef),
      tx.get(pictureRef),
      tx.get(userRef),
    ])
    if (!pictureSnap.exists) throw new HttpsError('not-found', 'Picture not found.')

    // Hearting a photo you already hearted is an idempotent no-op rather than an error: the
    // client has no way to know it voted on a previous visit, so an error there is just a dead
    // tap. Nothing is written, so neither the per-artist allowance nor the daily ceiling below
    // moves on a repeat — a fan who has spent all three can still re-open one of those three
    // and have it resolve to the filled heart instead of a quota error.
    if (voteSnap.exists) {
      return { voteCount: (pictureSnap.data()?.voteCount ?? 0) as number, alreadyVoted: true }
    }

    const userData = userSnap.data() ?? {}

    // Spend is tracked as a map on the user doc rather than by counting pictureVotes docs: it
    // is bounded by the roster (107 artists), it is written in the same transaction as the
    // vote, and the client already subscribes to this doc — so the remaining count renders
    // with no extra read.
    const votesByArtist = (userData.pictureVotesByArtist ?? {}) as Record<string, number>
    const spentOnArtist = votesByArtist[artistId] ?? 0
    if (spentOnArtist >= PICTURE_VOTES_PER_ARTIST) {
      throw new HttpsError(
        'resource-exhausted',
        `You've used all ${PICTURE_VOTES_PER_ARTIST} of your picture votes for this artist. They don't reset — but every other artist still has ${PICTURE_VOTES_PER_ARTIST} waiting.`,
      )
    }

    const heartsToday =
      (userData.pictureHeartsDate as string | undefined) === todayKst
        ? ((userData.pictureHeartsToday as number | undefined) ?? 0)
        : 0
    if (heartsToday >= DAILY_HEART_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Daily picture-heart limit reached — come back tomorrow!')
    }

    tx.set(voteRef, { uid, pictureId, artistId, createdAt: FieldValue.serverTimestamp() })
    tx.update(pictureRef, { voteCount: FieldValue.increment(1) })
    // merge:true deep-merges the nested map, so only this artist's key is touched.
    tx.set(
      userRef,
      {
        pictureHeartsToday: heartsToday + 1,
        pictureHeartsDate: todayKst,
        pictureVotesByArtist: { [artistId]: spentOnArtist + 1 },
      },
      { merge: true },
    )

    return { voteCount: ((pictureSnap.data()?.voteCount ?? 0) as number) + 1, alreadyVoted: false }
  })
})
