import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'

const BATCH_SIZE = 400

async function resetField(field: 'weeklyVotes' | 'monthlyVotes' | 'yearlyVotes') {
  const db = getFirestore()
  const snap = await db.collection('artists').get()
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    snap.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.update(doc.ref, { [field]: 0 }))
    await batch.commit()
  }
  console.log(`Reset ${field} to 0 for ${snap.size} artists.`)
}

// The daily ranking-history snapshot (dailySnapshot.ts) runs shortly before each of
// these, so the last data point in an artist's trend chart before a reset is that
// period's final tally — these jobs only need to zero the live counter.

export const resetWeeklyVotes = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'UTC' }, // every Monday 00:00 UTC
  () => resetField('weeklyVotes'),
)

export const resetMonthlyVotes = onSchedule(
  { schedule: '5 0 1 * *', timeZone: 'UTC' }, // 1st of month, 00:05 UTC
  () => resetField('monthlyVotes'),
)

export const resetYearlyVotes = onSchedule(
  { schedule: '10 0 1 1 *', timeZone: 'UTC' }, // Jan 1, 00:10 UTC
  () => resetField('yearlyVotes'),
)
