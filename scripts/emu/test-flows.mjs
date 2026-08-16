#!/usr/bin/env node
/**
 * End-to-end tests for the signed-in user flows, driven through the Cloud Functions
 * callables on the local emulator and asserted against emulator Firestore/Storage state.
 *
 * Run with the emulators up:
 *   source scripts/emu/env.sh && node scripts/emu/seed.mjs && node scripts/emu/test-flows.mjs
 */
import {
  assertEmulator,
  adminApp,
  createUser,
  freshToken,
  callFn,
  check,
  checkEq,
  summary,
  getFirestore,
  getStorage,
  FieldValue,
} from './lib.mjs'

assertEmulator()
adminApp()
const db = getFirestore()
const bucket = getStorage().bucket()

const A = { aurora: 'aurora', nova: 'nova', zenith: 'zenith', lumen: 'lumen' }

const me = await createUser('tester@example.com', 'password123', 'Test Fan')
const other = await createUser('other@example.com', 'password123', 'Other Fan')
let TOKEN = await freshToken(me.email, me.password)
let OTHER_TOKEN = await freshToken(other.email, other.password)

/* ---------------------------------------------------------------- date helpers */
const KST = 9 * 3600_000
const kstDay = (offsetDays = 0) =>
  new Date(Date.now() + KST - offsetDays * 86400_000).toISOString().slice(0, 10)
function isoWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
const WEEK = isoWeekId()

/* ---------------------------------------------------------------- state helpers */
async function wipe() {
  const cols = ['users', 'fandomStats', 'handles', 'profiles', 'pictureVotes']
  for (const c of cols) {
    const snap = await db.collection(c).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
  for (const id of Object.values(A)) {
    for (const sub of ['pictures', 'comments']) {
      const snap = await db.collection(`artists/${id}/${sub}`).get()
      await Promise.all(snap.docs.map((d) => d.ref.delete()))
    }
    await db.doc(`artists/${id}`).set({ weeklyVotes: 0, monthlyVotes: 0, yearlyVotes: 0 }, { merge: true })
  }
}

/** Mirrors ensureUserProfile() in src/contexts/AuthContext.tsx. */
async function ensureUserDoc(uid, displayName) {
  await db.doc(`users/${uid}`).set({
    displayName,
    photoURL: null,
    email: `${uid}@example.com`,
    createdAt: FieldValue.serverTimestamp(),
    weeklyArtistVotes: {},
    activeUploadCount: 0,
    totalVotes: 0,
    currentStreak: 0,
    longestStreak: 0,
    referralCount: 0,
  })
}

const userDoc = async (uid = me.uid) => (await db.doc(`users/${uid}`).get()).data() ?? {}
const artistDoc = async (id) => (await db.doc(`artists/${id}`).get()).data() ?? {}
const statsDoc = async (id) => (await db.doc(`fandomStats/${id}`).get()).data() ?? {}
const profileDoc = async (uid = me.uid) => (await db.doc(`profiles/${uid}`).get()).data() ?? null

async function reset() {
  await wipe()
  await ensureUserDoc(me.uid, 'Test Fan')
  await ensureUserDoc(other.uid, 'Other Fan')
}

const vote = (artistId, token = TOKEN) => callFn('castArtistVote', { artistId }, token)
const heart = (token = TOKEN) => callFn('claimDailyHeart', null, token)
const join = (artistId, token = TOKEN) => callFn('joinFandom', { artistId }, token)

/* ================================================================= 1. VOTING */
console.log('\n--- Flow 1: voting ---')
await reset()

let r = await vote(A.aurora)
check('vote 1 succeeds', r.ok, JSON.stringify(r.error ?? r.data))
checkEq('vote 1 reports 2 remaining', r.data?.weeklyVotesRemaining, 2)
let a = await artistDoc(A.aurora)
checkEq('artist weekly/monthly/yearly all +1', [a.weeklyVotes, a.monthlyVotes, a.yearlyVotes], [1, 1, 1])
let u = await userDoc()
checkEq('user totalVotes = 1', u.totalVotes, 1)
checkEq('weeklyArtistVotes records the artist', u.weeklyArtistVotes?.[WEEK], ['aurora'])
checkEq('streak set to 1 by first vote', u.currentStreak, 1)

r = await vote(A.aurora)
check('2nd vote for SAME artist rejected', !r.ok && r.error.status === 'ALREADY_EXISTS', JSON.stringify(r.error))
checkEq('artist weeklyVotes unchanged after dup', (await artistDoc(A.aurora)).weeklyVotes, 1)

r = await vote(A.nova)
checkEq('vote 2 (different artist) ok, 1 remaining', r.ok && r.data.weeklyVotesRemaining, 1)
r = await vote(A.zenith)
checkEq('vote 3 (different artist) ok, 0 remaining', r.ok && r.data.weeklyVotesRemaining, 0)

r = await vote(A.lumen)
check('4th vote rejected as resource-exhausted', !r.ok && r.error.status === 'RESOURCE_EXHAUSTED', JSON.stringify(r.error))
u = await userDoc()
checkEq('user totalVotes = 3 after the rejected 4th', u.totalVotes, 3)
checkEq('lumen got no votes', (await artistDoc(A.lumen)).weeklyVotes, 0)

// Stale-week pruning
await reset()
await db.doc(`users/${me.uid}`).set(
  { weeklyArtistVotes: { '2020-W01': ['aurora'], '2021-W05': ['nova'] } },
  { merge: true },
)
r = await vote(A.zenith)
u = await userDoc()
checkEq('stale week keys pruned on vote', Object.keys(u.weeklyArtistVotes ?? {}), [WEEK])
checkEq('current week ballot correct after prune', u.weeklyArtistVotes[WEEK], ['zenith'])

/* --------------------------------------------- warm ping (see functions/src/votes.ts) */
console.log('\n--- Flow 1b: the warm-up ping must be side-effect free ---')
await reset()
const beforeWarm = await userDoc()
r = await callFn('castArtistVote', { warm: true }, TOKEN)
check('warm ping succeeds', r.ok, JSON.stringify(r.error))
checkEq('warm ping returns the warmed marker', r.data, { warmed: true })
const afterWarm = await userDoc()
checkEq('warm ping does not spend a vote', afterWarm.totalVotes, beforeWarm.totalVotes ?? 0)
checkEq('warm ping does not touch the ballot', afterWarm.weeklyArtistVotes, {})
checkEq('warm ping does not advance the streak', afterWarm.currentStreak ?? 0, 0)
checkEq('warm ping does not set lastVoteDate', afterWarm.lastVoteDate ?? null, null)
checkEq('warm ping does not touch artist counters', (await artistDoc(A.aurora)).weeklyVotes, 0)
r = await callFn('castArtistVote', { warm: true })
check('warm ping still requires auth', !r.ok && r.error.status === 'UNAUTHENTICATED', JSON.stringify(r.error))
// A warm ping must not be usable to bypass the artistId requirement.
r = await callFn('castArtistVote', { warm: false }, TOKEN)
check('warm:false without artistId is still invalid-argument', !r.ok && r.error.status === 'INVALID_ARGUMENT', JSON.stringify(r.error))
// And a real vote after a warm ping behaves normally.
r = await vote(A.aurora)
checkEq('a real vote after a warm ping still works', r.ok && r.data.weeklyVotesRemaining, 2)
checkEq('artist counter incremented by the real vote', (await artistDoc(A.aurora)).weeklyVotes, 1)

/* ================================================================= 2. STREAK */
console.log('\n--- Flow 2: streak state machine ---')
await reset()
await join(A.aurora)

r = await heart()
checkEq('first action sets currentStreak = 1', r.ok && r.data.currentStreak, 1)
checkEq('first action reports streakAdvanced', r.ok && r.data.streakAdvanced, true)

// Same KST day, via the *other* streak-advancing action (a vote) — must not double-advance.
r = await vote(A.aurora)
checkEq('same-day vote does not advance streak', r.ok && r.data.streakAdvanced, false)
checkEq('same-day vote leaves streak at 1', r.ok && r.data.currentStreak, 1)
checkEq('user doc streak still 1', (await userDoc()).currentStreak, 1)

/** Rewrites the stored streak state, then claims a heart as "today". */
async function streakCase(name, seed, expect) {
  await db.doc(`users/${me.uid}`).set(
    { lastVoteDate: seed.last, lastHeartDate: seed.last, currentStreak: seed.streak, streakFreezes: seed.freezes, longestStreak: seed.streak },
    { merge: true },
  )
  const res = await heart()
  if (!res.ok) return check(name, false, JSON.stringify(res.error))
  const got = { streak: res.data.currentStreak, freezes: res.data.streakFreezes, freezeUsed: res.data.freezeUsed }
  return checkEq(name, got, expect)
}

await streakCase(
  'acted yesterday → +1',
  { last: kstDay(1), streak: 5, freezes: 0 },
  { streak: 6, freezes: 0, freezeUsed: false },
)
await streakCase(
  'skipped 1 day WITH a freeze → continues, freeze decrements',
  { last: kstDay(2), streak: 7, freezes: 1 },
  { streak: 8, freezes: 0, freezeUsed: true },
)
await streakCase(
  'skipped 1 day WITHOUT a freeze → resets to 1',
  { last: kstDay(2), streak: 9, freezes: 0 },
  { streak: 1, freezes: 0, freezeUsed: false },
)
await streakCase(
  'skipped 3 days → resets to 1 (even with a freeze banked)',
  { last: kstDay(3), streak: 12, freezes: 1 },
  { streak: 1, freezes: 1, freezeUsed: false },
)
await streakCase(
  'landing on day 30 banks a freeze',
  { last: kstDay(1), streak: 29, freezes: 0 },
  { streak: 30, freezes: 1, freezeUsed: false },
)
await streakCase(
  'landing on day 60 with 2 banked stays capped at 2',
  { last: kstDay(1), streak: 59, freezes: 2 },
  { streak: 60, freezes: 2, freezeUsed: false },
)
await streakCase(
  'day-30 landing reached via a freeze still banks (net 0 change)',
  { last: kstDay(2), streak: 29, freezes: 1 },
  { streak: 30, freezes: 1, freezeUsed: true },
)

// longestStreak must be a high-water mark, never decrease
await db.doc(`users/${me.uid}`).set(
  { lastVoteDate: kstDay(5), lastHeartDate: kstDay(5), currentStreak: 40, longestStreak: 40, streakFreezes: 0 },
  { merge: true },
)
r = await heart()
checkEq('reset keeps longestStreak high-water mark', (await userDoc()).longestStreak, 40)
checkEq('reset drops currentStreak to 1', r.ok && r.data.currentStreak, 1)

/* ================================================================= 3. DAILY HEART */
console.log('\n--- Flow 3: daily heart ---')
await reset()

r = await heart()
check('heart without a fandom is rejected', !r.ok && r.error.status === 'FAILED_PRECONDITION', JSON.stringify(r.error))

await join(A.nova)
r = await heart()
check('heart succeeds after joining a fandom', r.ok, JSON.stringify(r.error))
let s = await statsDoc(A.nova)
checkEq('fandomStats weeklyHearts = 1', s.weeklyHearts, 1)
checkEq('fandomStats totalHearts = 1', s.totalHearts, 1)
checkEq('claim reports weeklyHearts', r.ok && r.data.weeklyHearts, 1)
checkEq('heart advanced the shared streak', (await userDoc()).currentStreak, 1)
checkEq('lastHeartDate set to today KST', (await userDoc()).lastHeartDate, kstDay(0))

r = await heart()
check('2nd heart the same KST day rejected', !r.ok && r.error.status === 'ALREADY_EXISTS', JSON.stringify(r.error))
checkEq('weeklyHearts not double-counted', (await statsDoc(A.nova)).weeklyHearts, 1)

// The heart and the vote share one streak: a heart yesterday + a vote today = 2.
await db.doc(`users/${me.uid}`).set(
  { lastVoteDate: kstDay(1), lastHeartDate: kstDay(1), currentStreak: 1 },
  { merge: true },
)
r = await vote(A.aurora)
checkEq('vote continues the streak a heart started', r.ok && r.data.currentStreak, 2)

/* ================================================================= 4. FANDOMS */
console.log('\n--- Flow 4: join / switch / leave ---')
await reset()

await join(A.aurora)
checkEq('join → memberCount 1', (await statsDoc(A.aurora)).memberCount, 1)
checkEq('join → biasArtistId set', (await userDoc()).biasArtistId, 'aurora')

await join(A.aurora)
checkEq('re-joining the same fandom does not double-count', (await statsDoc(A.aurora)).memberCount, 1)

await join(A.nova)
checkEq('switch → old fandom memberCount 0', (await statsDoc(A.aurora)).memberCount, 0)
checkEq('switch → new fandom memberCount 1', (await statsDoc(A.nova)).memberCount, 1)

// A second member, so leave() is observable against a non-zero base.
await join(A.nova, OTHER_TOKEN)
checkEq('second member → memberCount 2', (await statsDoc(A.nova)).memberCount, 2)

await join(null)
checkEq('leave → memberCount back to 1', (await statsDoc(A.nova)).memberCount, 1)
checkEq('leave → biasArtistId null', (await userDoc()).biasArtistId, null)

r = await join('does-not-exist')
check('joining a missing artist is rejected', !r.ok && r.error.status === 'NOT_FOUND', JSON.stringify(r.error))

// Profile projection follows the fandom once a handle exists.
r = await callFn('claimHandle', { handle: 'fandomfan' }, TOKEN)
check('handle claimed for projection test', r.ok, JSON.stringify(r.error))
await join(A.zenith)
let p = await profileDoc()
checkEq('projection biasArtistId updated on join', p?.biasArtistId, 'zenith')
checkEq('projection fandomName denormalized', p?.fandomName, 'Zeniths')
checkEq('projection fandomColorHex denormalized', p?.fandomColorHex, '#0EA5E9')
await join(null)
p = await profileDoc()
checkEq('projection cleared on leave', [p?.biasArtistId, p?.fandomName, p?.fandomColorHex], [null, null, null])

/* ================================================================= 5. PICTURES */
console.log('\n--- Flow 5: pictures ---')
await reset()

async function putObject(artistId, uid, name) {
  const path = `artists/${artistId}/uploads/${uid}/${Date.now()}-${name}`
  await bucket.file(path).save(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]), { contentType: 'image/jpeg' })
  return path
}
const objectExists = async (path) => (await bucket.file(path).exists())[0]

const paths = []
const pictureIds = []
for (let i = 1; i <= 3; i++) {
  const path = await putObject(A.aurora, me.uid, `p${i}.jpg`)
  const res = await callFn('createPictureDoc', { artistId: A.aurora, storagePath: path, credit: 'me' }, TOKEN)
  if (!res.ok) { check(`upload ${i} succeeds`, false, JSON.stringify(res.error)); break }
  paths.push(path)
  pictureIds.push(res.data.pictureId)
  check(`upload ${i} succeeds`, true)
}
checkEq('activeUploadCount = 3', (await userDoc()).activeUploadCount, 3)
checkEq('3 picture docs exist', (await db.collection(`artists/${A.aurora}/pictures`).get()).size, 3)
const firstPic = (await db.doc(`artists/${A.aurora}/pictures/${pictureIds[0]}`).get()).data()
checkEq('picture doc starts at voteCount 0', firstPic.voteCount, 0)
checkEq('picture doc records uploader', firstPic.uploadedBy, me.uid)

const fourthPath = await putObject(A.aurora, me.uid, 'p4.jpg')
r = await callFn('createPictureDoc', { artistId: A.aurora, storagePath: fourthPath, credit: '' }, TOKEN)
check('4th upload rejected (resource-exhausted)', !r.ok && r.error.status === 'RESOURCE_EXHAUSTED', JSON.stringify(r.error))
checkEq('activeUploadCount still 3 after rejection', (await userDoc()).activeUploadCount, 3)
check('rejected upload cleans up its storage object', !(await objectExists(fourthPath)))

// Uploading to a path that is not your own uid folder
const foreignPath = `artists/${A.aurora}/uploads/${other.uid}/sneaky.jpg`
r = await callFn('createPictureDoc', { artistId: A.aurora, storagePath: foreignPath }, TOKEN)
check("cannot create a doc for another user's storage path", !r.ok && r.error.status === 'INVALID_ARGUMENT', JSON.stringify(r.error))

// Hearting
r = await callFn('votePicture', { pictureId: pictureIds[0], artistId: A.aurora }, TOKEN)
checkEq('heart a picture → voteCount 1', r.ok && r.data.voteCount, 1)
checkEq('heart reports alreadyVoted false', r.ok && r.data.alreadyVoted, false)
checkEq('picture doc voteCount persisted', (await db.doc(`artists/${A.aurora}/pictures/${pictureIds[0]}`).get()).data().voteCount, 1)
checkEq('daily heart quota consumed once', (await userDoc()).pictureHeartsToday, 1)

r = await callFn('votePicture', { pictureId: pictureIds[0], artistId: A.aurora }, TOKEN)
check('re-heart resolves instead of erroring', r.ok, JSON.stringify(r.error))
checkEq('re-heart returns alreadyVoted true', r.ok && r.data.alreadyVoted, true)
checkEq('re-heart does not bump voteCount', (await db.doc(`artists/${A.aurora}/pictures/${pictureIds[0]}`).get()).data().voteCount, 1)
checkEq('re-heart does NOT consume daily quota', (await userDoc()).pictureHeartsToday, 1)

r = await callFn('votePicture', { pictureId: 'nope', artistId: A.aurora }, TOKEN)
check('hearting a missing picture is not-found', !r.ok && r.error.status === 'NOT_FOUND', JSON.stringify(r.error))

// 50/day cap
await db.doc(`users/${me.uid}`).set({ pictureHeartsToday: 50, pictureHeartsDate: kstDay(0) }, { merge: true })
r = await callFn('votePicture', { pictureId: pictureIds[1], artistId: A.aurora }, TOKEN)
check('51st heart of the day rejected (resource-exhausted)', !r.ok && r.error.status === 'RESOURCE_EXHAUSTED', JSON.stringify(r.error))
// ...and the counter rolls over on a new KST day
await db.doc(`users/${me.uid}`).set({ pictureHeartsToday: 50, pictureHeartsDate: kstDay(1) }, { merge: true })
r = await callFn('votePicture', { pictureId: pictureIds[1], artistId: A.aurora }, TOKEN)
check('yesterday\'s 50 do not block today', r.ok, JSON.stringify(r.error))
checkEq('quota counter restarts at 1 on the new day', (await userDoc()).pictureHeartsToday, 1)

// Delete
r = await callFn('deletePicture', { artistId: A.aurora, pictureId: pictureIds[2] }, TOKEN)
check('delete own picture succeeds', r.ok, JSON.stringify(r.error))
checkEq('activeUploadCount decremented', (await userDoc()).activeUploadCount, 2)
check('picture doc removed', !(await db.doc(`artists/${A.aurora}/pictures/${pictureIds[2]}`).get()).exists)
check('storage object removed', !(await objectExists(paths[2])))

r = await callFn('deletePicture', { artistId: A.aurora, pictureId: pictureIds[0] }, OTHER_TOKEN)
check("cannot delete another user's picture", !r.ok && r.error.status === 'PERMISSION_DENIED', JSON.stringify(r.error))

/* ================================================================= 6. HANDLE */
console.log('\n--- Flow 6: handle ---')
await reset()

r = await callFn('claimHandle', { handle: 'testfan' }, TOKEN)
checkEq('claim handle succeeds', r.ok && r.data.handle, 'testfan')
checkEq('users doc carries the handle', (await userDoc()).handle, 'testfan')
checkEq('handles/{handle} maps to uid', (await db.doc('handles/testfan').get()).data()?.uid, me.uid)

p = await profileDoc()
check('profiles/{uid} projection created', !!p)
const allowed = ['handle', 'biasArtistId', 'fandomName', 'fandomColorHex', 'currentStreak', 'longestStreak', 'totalVotes', 'activeUploadCount', 'joinedAt', 'updatedAt']
const leaked = Object.keys(p ?? {}).filter((k) => !allowed.includes(k))
checkEq('projection carries ONLY the allowed fields', leaked, [])
check('projection has no displayName', !('displayName' in (p ?? {})))
check('projection has no email', !('email' in (p ?? {})))
check('projection has no photoURL', !('photoURL' in (p ?? {})))
check('projection has no weeklyArtistVotes', !('weeklyArtistVotes' in (p ?? {})))

r = await callFn('claimHandle', { handle: 'testfan' }, OTHER_TOKEN)
check('duplicate handle rejected', !r.ok && r.error.status === 'ALREADY_EXISTS', JSON.stringify(r.error))
r = await callFn('claimHandle', { handle: 'TESTFAN' }, OTHER_TOKEN)
check('duplicate handle rejected case-insensitively', !r.ok && r.error.status === 'ALREADY_EXISTS', JSON.stringify(r.error))

r = await callFn('claimHandle', { handle: 'secondhandle' }, TOKEN)
check('second claim by the same user rejected', !r.ok && r.error.status === 'FAILED_PRECONDITION', JSON.stringify(r.error))

for (const reserved of ['admin', 'psalmtune', 'staff', 'login']) {
  r = await callFn('claimHandle', { handle: reserved }, OTHER_TOKEN)
  check(`reserved handle "${reserved}" rejected`, !r.ok && r.error.status === 'INVALID_ARGUMENT', JSON.stringify(r.error))
}
for (const bad of ['ab', 'has space', 'dash-dash', 'way_too_long_handle_here', 'emoji😀', '']) {
  r = await callFn('claimHandle', { handle: bad }, OTHER_TOKEN)
  check(`invalid handle ${JSON.stringify(bad)} rejected`, !r.ok && r.error.status === 'INVALID_ARGUMENT', JSON.stringify(r.error))
}
// Uppercase input is normalised, not rejected.
r = await callFn('claimHandle', { handle: '  MixedCase  ' }, OTHER_TOKEN)
checkEq('mixed-case input normalised to lowercase', r.ok && r.data.handle, 'mixedcase')

/* ================================================================= projection drift */
console.log('\n--- Flow 6b: projection stays in sync ---')
await reset()
await callFn('claimHandle', { handle: 'syncfan' }, TOKEN)
await vote(A.aurora)
await vote(A.nova)
p = await profileDoc()
u = await userDoc()
checkEq('projection totalVotes tracks the user doc', p?.totalVotes, u.totalVotes)
checkEq('projection currentStreak tracks the user doc', p?.currentStreak, u.currentStreak)

const path = await putObject(A.aurora, me.uid, 'sync.jpg')
r = await callFn('createPictureDoc', { artistId: A.aurora, storagePath: path }, TOKEN)
p = await profileDoc()
checkEq('projection activeUploadCount tracks uploads', p?.activeUploadCount, (await userDoc()).activeUploadCount)
await callFn('deletePicture', { artistId: A.aurora, pictureId: r.data.pictureId }, TOKEN)
p = await profileDoc()
checkEq('projection activeUploadCount tracks deletes', p?.activeUploadCount, (await userDoc()).activeUploadCount)

process.exit(summary('callable flows') === 0 ? 0 : 1)
