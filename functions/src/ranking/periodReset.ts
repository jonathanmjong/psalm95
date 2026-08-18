import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentWeekId } from '../dates'

const BATCH_SIZE = 400

export async function resetField(field: 'weeklyVotes' | 'monthlyVotes' | 'yearlyVotes') {
  const db = getFirestore()
  const snap = await db.collection('artists').get()
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    snap.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.update(doc.ref, { [field]: 0 }))
    await batch.commit()
  }
  console.log(`Reset ${field} to 0 for ${snap.size} artists.`)
}

/** Daily hearts are a weekly currency too: zero every fandom's counter alongside the votes.
 * Uses merge-set so fandoms that never received a heart simply gain the field. */
export async function resetFandomHearts() {
  const db = getFirestore()
  const snap = await db.collection('fandomStats').get()
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch()
    snap.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.set(doc.ref, { weeklyHearts: 0 }, { merge: true }))
    await batch.commit()
  }
  console.log(`Reset weeklyHearts to 0 for ${snap.size} fandoms.`)
}

/** Before wiping weekly votes, crown the week's most-voted artist into the Hall of Fame.
 * Runs at the start of the new ISO week, so the week that just ended is "yesterday's" week. */
export async function captureWeeklyWinner(now: Date = new Date()) {
  const db = getFirestore()
  const endedWeekId = currentWeekId(new Date(now.getTime() - 86_400_000))
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
    // The Admin SDK rejects undefined outright, and this write used to run *before* the
    // vote reset — so one artist added without a region threw here and left every artist
    // carrying last week's votes into the new week, with nothing surfacing the failure.
    artistName: winner.data().name ?? winner.id,
    region: winner.data().region ?? null,
    votes,
    capturedAt: FieldValue.serverTimestamp(),
  })
  console.log(`Hall of Fame: ${winner.data().name} won ${endedWeekId} with ${votes} votes.`)
}

// The daily ranking-history snapshot (dailySnapshot.ts) runs at 23:50 UTC, before each of
// these, so the last data point in an artist's trend chart before a reset is that
// period's final tally — these jobs only need to zero the live counter.

/** Crown-then-zero, as a plain function so tests can drive it without a pubsub emulator.
 * `now` is injectable purely so a test can pin the "week that just ended". */
export async function resetWeeklyVotesNow(now: Date = new Date()) {
  // Crown first so the Hall of Fame sees the week's real totals — but never let a failure
  // there stop the reset. A missed crown loses one week of history; a missed reset carries
  // every artist's votes into the next week and quietly corrupts the board until noticed.
  try {
    await captureWeeklyWinner(now)
  } catch (err) {
    console.error('Hall of Fame capture failed; continuing with the weekly reset:', err)
  }
  await resetField('weeklyVotes')
}

export const resetWeeklyVotes = onSchedule(
  { schedule: '0 0 * * 1', timeZone: 'UTC' }, // every Monday 00:00 UTC
  () => resetWeeklyVotesNow(),
)

/** Hearts are claimed on the midnight-KST day boundary, so their week has to end on that
 * same clock — folded into the 00:00 UTC vote reset, a Korean fan who claimed at 08:00 KST
 * Monday watched the heart vanish an hour later while the card still read "Claimed today". */
export const resetFandomHeartsWeekly = onSchedule(
  { schedule: '0 15 * * 0', timeZone: 'UTC' }, // Sunday 15:00 UTC = Monday 00:00 KST
  () => resetFandomHearts(),
)

export const resetMonthlyVotes = onSchedule(
  { schedule: '5 0 1 * *', timeZone: 'UTC' }, // 1st of month, 00:05 UTC
  () => resetField('monthlyVotes'),
)

export const resetYearlyVotes = onSchedule(
  { schedule: '10 0 1 1 *', timeZone: 'UTC' }, // Jan 1, 00:10 UTC
  () => resetField('yearlyVotes'),
)
