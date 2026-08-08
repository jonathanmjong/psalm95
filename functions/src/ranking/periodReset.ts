import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentWeekId } from '../dates'

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

/** Before wiping weekly votes, crown the week's most-voted artist into the Hall of Fame.
 * Runs at the start of the new ISO week, so the week that just ended is "yesterday's" week. */
async function captureWeeklyWinner() {
  const db = getFirestore()
  const endedWeekId = currentWeekId(new Date(Date.now() - 86_400_000))
  const top = await db.collection('artists').orderBy('weeklyVotes', 'desc').limit(1).get()
  if (top.empty) return
  const winner = top.docs[0]
  const votes = (winner.data().weeklyVotes as number) ?? 0
  if (votes <= 0) {
    console.log(`No weekly winner to crown for ${endedWeekId} (no votes).`)
    return
  }
  await db.doc(`hallOfFame/${endedWeekId}`).set({
    weekId: endedWeekId,
    artistId: winner.id,
    artistName: winner.data().name,
    region: winner.data().region,
    votes,
    capturedAt: FieldValue.serverTimestamp(),
  })
  console.log(`Hall of Fame: ${winner.data().name} won ${endedWeekId} with ${votes} votes.`)
}

// The daily ranking-history snapshot (dailySnapshot.ts) runs shortly before each of
// these, so the last data point in an artist's trend chart before a reset is that
// period's final tally — these jobs only need to zero the live counter.

export const resetWeeklyVotes = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'UTC' }, // every Monday 00:00 UTC
  async () => {
    await captureWeeklyWinner()
    await resetField('weeklyVotes')
  },
)

export const resetMonthlyVotes = onSchedule(
  { schedule: '5 0 1 * *', timeZone: 'UTC' }, // 1st of month, 00:05 UTC
  () => resetField('monthlyVotes'),
)

export const resetYearlyVotes = onSchedule(
  { schedule: '10 0 1 1 *', timeZone: 'UTC' }, // Jan 1, 00:10 UTC
  () => resetField('yearlyVotes'),
)
