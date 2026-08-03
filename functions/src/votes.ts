import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentWeekId, currentMonthId, currentYearId } from './dates'

const WEEKLY_VOTE_LIMIT = 3

export const castArtistVote = onCall<{ artistId: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to vote.')

  const { artistId } = request.data
  if (typeof artistId !== 'string' || !artistId) {
    throw new HttpsError('invalid-argument', 'artistId is required.')
  }

  const db = getFirestore()
  const weekId = currentWeekId()
  const monthId = currentMonthId()
  const yearId = currentYearId()

  const userRef = db.doc(`users/${uid}`)
  const artistRef = db.doc(`artists/${artistId}`)

  const weeklyVotesRemaining = await db.runTransaction(async (tx) => {
    const [userSnap, artistSnap] = await Promise.all([tx.get(userRef), tx.get(artistRef)])
    if (!artistSnap.exists) throw new HttpsError('not-found', 'Artist not found.')

    const weeklyArtistVotes = (userSnap.data()?.weeklyArtistVotes ?? {}) as Record<string, string[]>
    const thisWeek = weeklyArtistVotes[weekId] ?? []

    if (thisWeek.includes(artistId)) {
      throw new HttpsError('already-exists', 'You already voted for this artist this week.')
    }
    if (thisWeek.length >= WEEKLY_VOTE_LIMIT) {
      throw new HttpsError('resource-exhausted', 'You have used all 3 votes this week.')
    }

    const updatedWeek = [...thisWeek, artistId]
    tx.set(
      userRef,
      { weeklyArtistVotes: { ...weeklyArtistVotes, [weekId]: updatedWeek } },
      { merge: true },
    )
    tx.set(
      artistRef,
      {
        weeklyVotes: FieldValue.increment(1),
        monthlyVotes: FieldValue.increment(1),
        yearlyVotes: FieldValue.increment(1),
        currentWeekId: weekId,
        currentMonthId: monthId,
        currentYearId: yearId,
      },
      { merge: true },
    )

    return WEEKLY_VOTE_LIMIT - updatedWeek.length
  })

  return { weeklyVotesRemaining }
})
