import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

/** Runs daily and writes one point per artist to `rankingHistory` — the series the
 * frontend's week/month/year trend graphs read from. Doc id is the date, so re-running the
 * same day overwrites rather than duplicating.
 *
 * Scheduled at 23:50 UTC, i.e. *before* the period resets (Mon 00:00, 1st 00:05, Jan 1
 * 00:10). It used to run at 00:30 — after them — so every Monday's point recorded
 * weeklyVotes: 0 and each period's real closing tally was never persisted at all. */
export async function captureDailySnapshotNow(now: Date = new Date()) {
  const db = getFirestore()
  const dateId = now.toISOString().slice(0, 10) // YYYY-MM-DD
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
}

export const captureDailySnapshot = onSchedule({ schedule: '50 23 * * *', timeZone: 'UTC' }, () =>
  captureDailySnapshotNow(),
)
