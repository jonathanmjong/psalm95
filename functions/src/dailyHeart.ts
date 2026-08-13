import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentDayIdKST } from './dates'
import { advanceStreak } from './streak'
import { syncPublicProfile } from './handles'

/**
 * One free heart per KST day for the fandom the user has joined. Hearts are a separate,
 * lighter currency: they land on `fandomStats/{artistId}.weeklyHearts` and never touch
 * `artists/{id}.weeklyVotes` or the composite ranking, so the leaderboard formula stays
 * legible. Unclaimed hearts don't accumulate — a missed day is gone.
 */
export const claimDailyHeart = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to claim your daily heart.')

  const db = getFirestore()
  const todayKst = currentDayIdKST()
  const userRef = db.doc(`users/${uid}`)

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef)
    const userData = userSnap.data() ?? {}

    const biasArtistId = (userData.biasArtistId as string | undefined) || null
    if (!biasArtistId) {
      throw new HttpsError('failed-precondition', 'Join a fandom before claiming your daily heart.')
    }
    if ((userData.lastHeartDate as string | undefined) === todayKst) {
      throw new HttpsError('already-exists', 'You already claimed your heart today.')
    }

    const statsRef = db.doc(`fandomStats/${biasArtistId}`)
    const statsSnap = await tx.get(statsRef)
    const weeklyHearts = ((statsSnap.data()?.weeklyHearts as number | undefined) ?? 0) + 1

    const streak = advanceStreak(userData, todayKst)

    tx.set(userRef, { ...streak.fields, lastHeartDate: todayKst }, { merge: true })
    // Public projection (handle-holders only). `lastHeartDate` stays private — the public
    // page shows streak lengths, not a day-by-day activity log.
    syncPublicProfile(tx, db, uid, userData, {
      currentStreak: streak.fields.currentStreak,
      longestStreak: streak.fields.longestStreak,
    })
    tx.set(
      statsRef,
      { weeklyHearts: FieldValue.increment(1), totalHearts: FieldValue.increment(1) },
      { merge: true },
    )

    return {
      currentStreak: streak.fields.currentStreak,
      longestStreak: streak.fields.longestStreak,
      streakFreezes: streak.fields.streakFreezes,
      freezeUsed: streak.freezeUsed,
      streakAdvanced: streak.advanced,
      weeklyHearts,
    }
  })
})
