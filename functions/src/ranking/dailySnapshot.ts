import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/** Runs daily (after the hourly recompute has had a chance to run at least once) and
 * writes one point per artist to `rankingHistory` — the series the frontend's week/month
 * /year trend graphs read from. Doc id is the date, so re-running the same day overwrites
 * rather than duplicating. */
export const captureDailySnapshot = onSchedule(
  { schedule: '30 0 * * *', timeZone: 'UTC' },
  async () => {
    const db = getFirestore()
    const dateId = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const snap = await db.collection('artists').get()

    const writes = snap.docs.map((doc) => {
      const data = doc.data()
      return doc.ref.collection('rankingHistory').doc(dateId).set({
        date: dateId,
        compositeScore: data.compositeScore ?? 0,
        rank: data.rank ?? 0,
        popularity: data.metrics?.popularity?.value ?? 0,
        weeklyVotes: data.weeklyVotes ?? 0,
        monthlyVotes: data.monthlyVotes ?? 0,
        yearlyVotes: data.yearlyVotes ?? 0,
        capturedAt: FieldValue.serverTimestamp(),
      })
    })

    await Promise.all(writes)
    console.log(`Captured daily snapshot (${dateId}) for ${snap.size} artists.`)
  },
)
