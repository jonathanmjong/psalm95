import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { currentWeekId } from './dates'

const CURRENT = 'battles/current'

/** One vote per user per weekly battle. Increments the chosen side on battles/current. */
export const voteBattle = onCall<{ choiceArtistId: string }>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to vote.')
  const { choiceArtistId } = request.data
  if (!choiceArtistId) throw new HttpsError('invalid-argument', 'choiceArtistId is required.')

  const db = getFirestore()
  const battleRef = db.doc(CURRENT)

  return db.runTransaction(async (tx) => {
    const battleSnap = await tx.get(battleRef)
    if (!battleSnap.exists) throw new HttpsError('not-found', 'No active battle.')
    const battle = battleSnap.data()!
    if (choiceArtistId !== battle.aArtistId && choiceArtistId !== battle.bArtistId) {
      throw new HttpsError('invalid-argument', 'That artist is not in this battle.')
    }

    const voteRef = db.doc(`battleVotes/${uid}_${battle.weekId}`)
    if ((await tx.get(voteRef)).exists) {
      throw new HttpsError('already-exists', 'You already voted in this battle.')
    }

    const side = choiceArtistId === battle.aArtistId ? 'aVotes' : 'bVotes'
    tx.set(voteRef, { uid, weekId: battle.weekId, choice: choiceArtistId, createdAt: FieldValue.serverTimestamp() })
    tx.update(battleRef, { [side]: FieldValue.increment(1) })

    return {
      aVotes: (battle.aVotes ?? 0) + (side === 'aVotes' ? 1 : 0),
      bVotes: (battle.bVotes ?? 0) + (side === 'bVotes' ? 1 : 0),
      choice: choiceArtistId,
    }
  })
})

/** Copies the outgoing battle to battleArchive/{weekId} before it is overwritten, so past
 * matchups and their final tallies survive the Monday rollover (the battleVotes docs already do).
 * Runs inside the caller's transaction so the guard-check, archive, and rollover below commit
 * atomically — see createWeeklyBattleNow for why that matters. */
function archiveCurrentBattleTx(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  battle: FirebaseFirestore.DocumentData,
) {
  const weekId = battle.weekId as string | undefined
  if (!weekId) {
    console.log('Outgoing battle has no weekId — skipping archive.')
    return
  }
  const aVotes = (battle.aVotes as number) ?? 0
  const bVotes = (battle.bVotes as number) ?? 0
  const winner = aVotes === bVotes ? 'tie' : aVotes > bVotes ? 'a' : 'b'
  tx.set(db.doc(`battleArchive/${weekId}`), {
    ...battle,
    winner,
    archivedAt: FieldValue.serverTimestamp(),
  })
  console.log(`Archived battle ${weekId}: ${battle.aName} ${aVotes} — ${bVotes} ${battle.bName} (${winner}).`)
}

/** Picks a fresh weekly matchup from the top of the board. Runs Monday 00:15 UTC
 * (after the weekly reset + hall-of-fame capture). */
export async function createWeeklyBattleNow(now: Date = new Date()) {
  const db = getFirestore()
  const weekId = currentWeekId(now)

  const top = await db.collection('artists').orderBy('compositeScore', 'desc').limit(12).get()
  if (top.size < 2) {
    console.log('Not enough artists for a battle.')
    return
  }
  // Shuffle the top contenders and take two distinct.
  const docs = [...top.docs]
  for (let i = docs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[docs[i], docs[j]] = [docs[j], docs[i]]
  }
  const [a, b] = docs

  const currentRef = db.doc(CURRENT)
  // The guard-check, archive, and rollover all happen inside one transaction: Cloud
  // Scheduler delivers at-least-once, so a retried/duplicate invocation can otherwise read
  // the same outgoing battle before either has written, and both archive + overwrite it —
  // the second archive stomping the first with a fresh 0-0 matchup and orphaning any votes
  // already cast. Firestore's optimistic concurrency means a second transaction that reads
  // the same current-battle version conflicts with the first's write and retries, at which
  // point it sees the just-committed weekId and takes the no-op path below instead.
  const created = await db.runTransaction(async (tx) => {
    const snap = await tx.get(currentRef)
    if (snap.exists && snap.data()?.weekId === weekId) {
      return false
    }
    if (snap.exists) archiveCurrentBattleTx(tx, db, snap.data()!)
    tx.set(currentRef, {
      weekId,
      aArtistId: a.id,
      aName: a.data().name,
      aRegion: a.data().region,
      bArtistId: b.id,
      bName: b.data().name,
      bRegion: b.data().region,
      aVotes: 0,
      bVotes: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
    return true
  })

  if (!created) {
    console.log(`Battle for ${weekId} already exists — skipping.`)
    return
  }
  console.log(`New battle: ${a.data().name} vs ${b.data().name}.`)
}

export const createWeeklyBattle = onSchedule({ schedule: '15 0 * * 1', timeZone: 'UTC' }, () =>
  createWeeklyBattleNow(),
)
