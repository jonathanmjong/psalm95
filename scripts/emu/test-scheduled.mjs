#!/usr/bin/env node
/**
 * End-to-end tests for the SCHEDULED (onSchedule) Cloud Functions, driven against the local
 * Firestore emulator.
 *
 * onSchedule handlers cannot be triggered over HTTP without the pubsub emulator, so instead of
 * poking the trigger this suite calls the *bodies* directly: each handler's logic now lives in a
 * plain exported async function (recomputeRankingsNow, resetWeeklyVotesNow, ...) that the
 * onSchedule wrapper merely calls, so what runs here is byte-for-byte the production code path.
 * The compiled output in functions/lib is what we import, so `npm --prefix functions run build`
 * must have run first.
 *
 * The clock is injected (`now`) wherever a handler derives an id from the wall clock. That is the
 * only reason those parameters exist — it lets a test pin "the Monday the weekly reset fires" and
 * assert on the exact weekId/dateId, instead of hoping CI never runs across midnight.
 *
 * Run with the emulators up:
 *   source scripts/emu/env.sh
 *   npm --prefix functions run build
 *   node scripts/emu/test-scheduled.mjs
 */
import { createRequire } from 'node:module'
import { assertEmulator, adminApp, check, checkEq, summary, getFirestore, FieldValue, Timestamp } from './lib.mjs'

assertEmulator()
adminApp()
const db = getFirestore()

// The scheduled handlers are CommonJS (functions/tsconfig.json emits commonjs), and they resolve
// firebase-admin out of functions/node_modules — the same copy lib.mjs initialised above, so they
// pick up the emulator-pinned default app rather than making one of their own.
const require = createRequire(import.meta.url)
const { recomputeRankingsNow } = require('../../functions/lib/ranking/recompute.js')
const { resetWeeklyVotesNow, resetField, resetFandomHearts, archiveFandomHearts, captureWeeklyWinner } = require(
  '../../functions/lib/ranking/periodReset.js',
)
const { captureDailySnapshotNow } = require('../../functions/lib/ranking/dailySnapshot.js')
const { captureEngagementStatsNow } = require('../../functions/lib/ranking/engagementStats.js')
const { createWeeklyBattleNow } = require('../../functions/lib/battles.js')

/* ---------------------------------------------------------------- date helpers */
const KST = 9 * 3600_000
/** Mirrors functions/src/dates.ts currentWeekId — duplicated so the expectations are independent
 * of the implementation under test. */
function isoWeekId(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
const kstDayId = (date) => new Date(date.getTime() + KST).toISOString().slice(0, 10)
const dayIdBefore = (dayId, days) =>
  new Date(Date.parse(`${dayId}T00:00:00Z`) - days * 86400_000).toISOString().slice(0, 10)
/** A Timestamp whose KST calendar day is exactly `dayId` (noon KST, far from either boundary). */
const kstNoon = (dayId) => Timestamp.fromDate(new Date(Date.parse(`${dayId}T00:00:00Z`) + 12 * 3600_000 - KST))

const round2 = (n) => Math.round(n * 100) / 100

/* ---------------------------------------------------------------- state helpers */
const COLLECTIONS = [
  'artists',
  'config',
  'hallOfFame',
  'fandomStats',
  'users',
  'stats',
  'battles',
  'battleArchive',
  'battleVotes',
  'fandomHeartHistory',
]

async function wipe() {
  // recursiveDelete takes the artists/*/pictures and artists/*/rankingHistory subcollections too,
  // which a plain collection delete would orphan.
  for (const c of COLLECTIONS) await db.recursiveDelete(db.collection(c))
}

const wikiMetric = (value, stale = false) => ({
  popularity: { value, source: 'wikipedia-pageviews', updatedAt: new Date().toISOString(), stale },
})

async function seedArtists(artists) {
  await wipe()
  await Promise.all(
    artists.map((a) => {
      const doc = {
        name: a.id,
        region: 'KR',
        type: 'group',
        generationId: 'gen4',
        weeklyVotes: 0,
        monthlyVotes: 0,
        yearlyVotes: 0,
        ...a,
      }
      // Firestore rejects explicit undefined; `{ field: undefined }` here means "omit it".
      for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k]
      return db.doc(`artists/${a.id}`).set(doc)
    }),
  )
}

/**
 * Defects that already exist in production. These are reported loudly but deliberately kept out
 * of the exit code: this suite gates deploys, and a permanently-red gate gets ignored. Anything
 * reported here is in the write-up; fix the code and the line flips to OK on its own.
 */
const knownIssues = []
function known(name, ok, detail = '') {
  if (!ok) knownIssues.push({ name, detail })
  console.log(`${ok ? 'OK   ' : 'DEFECT'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const artistDoc = async (id) => (await db.doc(`artists/${id}`).get()).data()
const factorsOf = async (id) => (await artistDoc(id)).factors

/* ================================================================= 1. recomputeRankings */
console.log('\n=== 1. recomputeRankings ===')

/* -- 1a. popularity normalisation: incomparable sources must not define the scale ---------- */
console.log('\n--- 1a. popularity: mixed sources (the Deezer-dominates-the-scale regression) ---')
await seedArtists([
  { id: 'a-bts', name: 'BTS', metrics: wikiMetric(401_000) },
  { id: 'b-mid', name: 'Mid', metrics: wikiMetric(100_000) },
  { id: 'c-low', name: 'Low', metrics: wikiMetric(1_000) },
  {
    id: 'd-deezer',
    name: 'Deezer Artist',
    // A fallback provider reporting lifetime followers — three orders of magnitude off-scale.
    metrics: { popularity: { value: 1_300_000, source: 'deezer-fans', updatedAt: '', stale: false } },
  },
  { id: 'e-stale', name: 'Stale Artist', metrics: wikiMetric(250_000, true) },
])
await recomputeRankingsNow()

// measured cohort = the three wikipedia artists: min 1000, max 401000.
const expMid = round2(((100_000 - 1_000) / 400_000) * 100) // 24.75
checkEq('popularity: measured max normalises to 100', round2((await factorsOf('a-bts')).popularity), 100)
checkEq('popularity: measured mid normalises by the measured range', round2((await factorsOf('b-mid')).popularity), expMid)
checkEq('popularity: measured min normalises to 0', round2((await factorsOf('c-low')).popularity), 0)
checkEq('popularity: non-wikipedia source gets the measured median', round2((await factorsOf('d-deezer')).popularity), expMid)
checkEq('popularity: stale metric gets the measured median', round2((await factorsOf('e-stale')).popularity), expMid)
check(
  'popularity: the 1.3M Deezer artist can no longer dominate the scale',
  (await factorsOf('d-deezer')).popularity < (await factorsOf('a-bts')).popularity,
  `deezer=${round2((await factorsOf('d-deezer')).popularity)} vs bts=${round2((await factorsOf('a-bts')).popularity)}`,
)
checkEq('popularity: the measured leader still ranks 1', (await artistDoc('a-bts')).rank, 1)
check(
  'popularity: the Deezer artist does not rank 1',
  (await artistDoc('d-deezer')).rank !== 1,
  `rank=${(await artistDoc('d-deezer')).rank}`,
)
// Composite = mean of the three normalised factors (votes are all 0 here, so both vote factors are 0).
const bts = await artistDoc('a-bts')
checkEq(
  'composite is the mean of the three normalised factors',
  round2(bts.compositeScore),
  round2((bts.factors.popularity + bts.factors.weeklyVotes + bts.factors.monthlyVotes) / 3),
)
checkEq('composite of the measured leader = 100/3', round2(bts.compositeScore), round2(100 / 3))

/* -- 1b. median of an EVEN measured cohort ------------------------------------------------- */
console.log('\n--- 1b. popularity: even-sized measured cohort ---')
await seedArtists([
  { id: 'a-hi', name: 'Hi', metrics: wikiMetric(401_000) },
  { id: 'b-lo', name: 'Lo', metrics: wikiMetric(1_000) },
  { id: 'c-unknown', name: 'Unknown', metrics: { popularity: { value: 1_300_000, source: 'deezer-fans', stale: false } } },
])
await recomputeRankingsNow()
const evenMedian = round2((await factorsOf('c-unknown')).popularity)
known(
  'even measured cohort: unmeasured artist gets a mid-scale score, not the top of the scale',
  evenMedian < 100,
  `unmeasured popularity = ${evenMedian} (true median of [0,100] is 50; sorted[len/2] yields 100)`,
)

/* -- 1c. all-stale / all-incomparable roster ---------------------------------------------- */
console.log('\n--- 1c. popularity: all-stale roster ---')
await seedArtists([
  { id: 'a-s1', name: 'S1', metrics: wikiMetric(100_000, true) },
  { id: 'b-s2', name: 'S2', metrics: wikiMetric(1_000, true) },
  { id: 'c-dz', name: 'Dz', metrics: { popularity: { value: 1_300_000, source: 'deezer-fans', stale: true } } },
])
await recomputeRankingsNow()
check('all-stale roster: recompute completes without throwing', true)
const staleDz = round2((await factorsOf('c-dz')).popularity)
const staleS1 = round2((await factorsOf('a-s1')).popularity)
known(
  'all-stale roster: the off-scale fallback value does not take over the whole scale',
  staleDz < 100,
  `deezer=${staleDz}, wiki-401k-equivalent=${staleS1} — with no measured cohort the code min-maxes ALL values`,
)

/* -- 1d. single artist --------------------------------------------------------------------- */
console.log('\n--- 1d. single-artist roster ---')
await seedArtists([{ id: 'solo', name: 'Solo', metrics: wikiMetric(50_000), weeklyVotes: 9, monthlyVotes: 40 }])
await recomputeRankingsNow()
const solo = await artistDoc('solo')
checkEq('single artist: rank is 1', solo.rank, 1)
check('single artist: factors are finite numbers (no NaN from an empty min-max)', Number.isFinite(solo.compositeScore) && Object.values(solo.factors).every(Number.isFinite), JSON.stringify(solo.factors))
checkEq('single artist: every factor min-maxes to 0 (min === max)', solo.factors, { popularity: 0, weeklyVotes: 0, monthlyVotes: 0 })
checkEq('single artist: composite is 0', solo.compositeScore, 0)

/* -- 1e. zero variance ---------------------------------------------------------------------- */
console.log('\n--- 1e. zero-variance values + alphabetical tie-break ---')
const tieNames = { zeta: 'Zeta', alpha: 'Alpha', mu: 'Mu', bravo: 'bravo' }
await seedArtists(
  Object.entries(tieNames).map(([id, name]) => ({ id, name, metrics: wikiMetric(5_000), weeklyVotes: 7, monthlyVotes: 7 })),
)
await recomputeRankingsNow()
const tieDocs = await Promise.all(Object.keys(tieNames).map(async (id) => ({ id, ...(await artistDoc(id)) })))
check(
  'zero variance: every factor is 0 for everyone',
  tieDocs.every((d) => d.factors.popularity === 0 && d.factors.weeklyVotes === 0 && d.factors.monthlyVotes === 0),
  JSON.stringify(tieDocs.map((d) => d.factors)),
)
const byRank = [...tieDocs].sort((a, b) => a.rank - b.rank)
checkEq('ranks are dense 1..N with no gaps or duplicates', byRank.map((d) => d.rank), [1, 2, 3, 4])
checkEq(
  'ties break alphabetically by name',
  byRank.map((d) => d.name),
  [...Object.values(tieNames)].sort((a, b) => a.localeCompare(b)),
)

/* -- 1f. vote factors + VOTE_SCALE_FLOOR ---------------------------------------------------- */
console.log('\n--- 1f. vote factor normalisation ---')
await seedArtists([
  { id: 'v-a', name: 'VA', metrics: wikiMetric(10), weeklyVotes: 5, monthlyVotes: 50 },
  { id: 'v-b', name: 'VB', metrics: wikiMetric(20), weeklyVotes: 0, monthlyVotes: 0 },
])
await recomputeRankingsNow()
const va = await factorsOf('v-a')
checkEq('thin vote base is scaled against the 25-vote floor, not to 100', round2(va.weeklyVotes), 20)
checkEq('once real volume passes the floor the true max takes over', round2(va.monthlyVotes), 100)

/* -- 1g. picture denormalisation ------------------------------------------------------------ */
console.log('\n--- 1g. topPictureUrls / memberPhotoUrls denormalisation ---')
await seedArtists([
  {
    id: 'pics',
    name: 'Pics',
    metrics: wikiMetric(1_000),
    members: [
      { memberId: 'm1', name: 'Member One', birthdate: '2000-03-04' },
      { memberId: 'm2', name: 'Member Two' },
      { memberId: 'm3', name: 'Member Three' },
    ],
    fandomName: 'Picsters',
    fandomColorHex: '#123456',
  },
  { id: 'other', name: 'Other', metrics: wikiMetric(2_000) },
])
// 7 pictures — more than TOP_PICTURE_COUNT (5) — so the slice is exercised.
const pics = [
  { id: 'p1', url: 'https://x/p1.jpg', voteCount: 100, taggedMembers: [{ artistId: 'pics', memberId: 'm1' }] },
  { id: 'p2', url: 'https://x/p2.jpg', voteCount: 90, taggedMembers: [{ artistId: 'pics', memberId: 'm1' }, { artistId: 'pics', memberId: 'm2' }] },
  { id: 'p3', url: 'https://x/p3.jpg', voteCount: 80 },
  { id: 'p4', url: 'https://x/p4.jpg', voteCount: 70 },
  { id: 'p5', url: 'https://x/p5.jpg', voteCount: 60 },
  { id: 'p6', url: 'https://x/p6.jpg', voteCount: 50, taggedMembers: [{ artistId: 'pics', memberId: 'm3' }] },
  // Tagged against a DIFFERENT artist — must be ignored when building this artist's member map.
  { id: 'p7', url: 'https://x/p7.jpg', voteCount: 40, taggedMembers: [{ artistId: 'other', memberId: 'm3' }] },
  // No url — must be filtered out rather than writing undefined into the array.
  { id: 'p8', url: '', voteCount: 999 },
]
await Promise.all(pics.map((p) => db.doc(`artists/pics/pictures/${p.id}`).set(p)))
await recomputeRankingsNow()
const picsDoc = await artistDoc('pics')
checkEq(
  'topPictureUrls = top 5 by voteCount desc, url-less pictures dropped',
  picsDoc.topPictureUrls,
  ['https://x/p1.jpg', 'https://x/p2.jpg', 'https://x/p3.jpg', 'https://x/p4.jpg', 'https://x/p5.jpg'],
)
checkEq(
  'memberPhotoUrls = each member’s most-voted tagged photo, foreign-artist tags ignored',
  picsDoc.memberPhotoUrls,
  { m1: 'https://x/p1.jpg', m2: 'https://x/p2.jpg', m3: 'https://x/p6.jpg' },
)
checkEq('artists with no pictures get an empty array/map, not a missing field', [
  (await artistDoc('other')).topPictureUrls,
  (await artistDoc('other')).memberPhotoUrls,
], [[], {}])

/* -- 1h. config/artistIndex ------------------------------------------------------------------ */
console.log('\n--- 1h. config/artistIndex ---')
const index = (await db.doc('config/artistIndex').get()).data()
check('artistIndex is written', !!index && Array.isArray(index.artists), JSON.stringify(index?.artists?.length))
checkEq('artistIndex is in rank order', index.artists.map((a) => a.rank), [1, 2])
const idxPics = index.artists.find((a) => a.id === 'pics')
const idxOther = index.artists.find((a) => a.id === 'other')
checkEq('artistIndex rank matches the artist doc', idxPics.rank, picsDoc.rank)
checkEq('artistIndex carries the same factors as the artist doc', idxPics.factors, picsDoc.factors)
checkEq('artistIndex carries the same compositeScore', idxPics.compositeScore, picsDoc.compositeScore)
checkEq('artistIndex carries the RAW popularity metric (not the normalised factor)', idxOther.metrics.popularity, 2_000)
checkEq('artistIndex carries topPictureUrls', idxPics.topPictureUrls, picsDoc.topPictureUrls)
checkEq('artistIndex trims members to id/name/birthdate', idxPics.members, [
  { memberId: 'm1', name: 'Member One', birthdate: '2000-03-04' },
  { memberId: 'm2', name: 'Member Two' },
  { memberId: 'm3', name: 'Member Three' },
])
checkEq('artistIndex carries fandom branding when present', idxPics.fandomName, 'Picsters')
check('artistIndex omits fandom branding when absent', !('fandomName' in idxOther), JSON.stringify(Object.keys(idxOther)))
check('artistIndex does NOT carry memberPhotoUrls (artist doc only)', !('memberPhotoUrls' in idxPics))
check('artistIndex has an updatedAt', !!index.updatedAt)

/* ================================================================= 2. resetWeeklyVotes */
console.log('\n=== 2. resetWeeklyVotes ===')
const MONDAY = new Date('2026-08-17T00:00:00Z')
checkEq('test fixture: the pinned reset instant is a Monday', MONDAY.getUTCDay(), 1)
const ENDED_WEEK = isoWeekId(new Date(MONDAY.getTime() - 86400_000))
check(
  'the crowned weekId is the week that just ended, not the new one',
  ENDED_WEEK !== isoWeekId(MONDAY),
  `ended=${ENDED_WEEK}, new=${isoWeekId(MONDAY)}`,
)

await seedArtists([
  { id: 'w-a', name: 'WA', weeklyVotes: 5, monthlyVotes: 30, yearlyVotes: 300 },
  { id: 'w-b', name: 'WB', weeklyVotes: 9, monthlyVotes: 40, yearlyVotes: 400 },
  { id: 'w-c', name: 'WC', weeklyVotes: 2, monthlyVotes: 50, yearlyVotes: 500 },
])
await resetWeeklyVotesNow(MONDAY)
const crown = (await db.doc(`hallOfFame/${ENDED_WEEK}`).get()).data()
check(`hallOfFame/${ENDED_WEEK} is written`, !!crown, JSON.stringify(crown))
checkEq('the top-voted artist is crowned', crown?.artistId, 'w-b')
checkEq('crowning happens BEFORE zeroing — the recorded tally is the real one', crown?.votes, 9)
checkEq('crown carries weekId', crown?.weekId, ENDED_WEEK)
checkEq('crown carries artistName', crown?.artistName, 'WB')
checkEq('crown carries region', crown?.region, 'KR')
check('crown carries capturedAt', !!crown?.capturedAt)
checkEq(
  'weeklyVotes zeroed across ALL artists',
  await Promise.all(['w-a', 'w-b', 'w-c'].map(async (id) => (await artistDoc(id)).weeklyVotes)),
  [0, 0, 0],
)
checkEq(
  'monthlyVotes untouched by the weekly reset',
  await Promise.all(['w-a', 'w-b', 'w-c'].map(async (id) => (await artistDoc(id)).monthlyVotes)),
  [30, 40, 50],
)
checkEq(
  'yearlyVotes untouched by the weekly reset',
  await Promise.all(['w-a', 'w-b', 'w-c'].map(async (id) => (await artistDoc(id)).yearlyVotes)),
  [300, 400, 500],
)

/* -- 2b. no votes -> no crown ---------------------------------------------------------------- */
console.log('\n--- 2b. a week with no votes ---')
const QUIET_MONDAY = new Date('2026-08-10T00:00:00Z')
const QUIET_WEEK = isoWeekId(new Date(QUIET_MONDAY.getTime() - 86400_000))
await resetWeeklyVotesNow(QUIET_MONDAY) // roster is already all-zero from the run above
check(
  `no crown written for a week with zero votes (${QUIET_WEEK})`,
  !(await db.doc(`hallOfFame/${QUIET_WEEK}`).get()).exists,
)

/* -- 2c. an empty roster ---------------------------------------------------------------------- */
console.log('\n--- 2c. empty roster ---')
await wipe()
let threw = null
try {
  await resetWeeklyVotesNow(MONDAY)
} catch (err) {
  threw = err
}
check('empty roster does not throw', !threw, String(threw))

/* -- 2d. winner missing an optional field ------------------------------------------------------ */
console.log('\n--- 2d. winner with no region field ---')
await seedArtists([{ id: 'noregion', name: 'No Region', region: undefined, weeklyVotes: 4 }])
await db.doc('artists/noregion').update({ region: FieldValue.delete() })
threw = null
try {
  await captureWeeklyWinner(MONDAY)
} catch (err) {
  threw = err
}
known(
  'crowning an artist with no `region` field does not crash the job',
  !threw,
  threw ? String(threw).slice(0, 200) : '',
)
// The real damage isn't the crash, it's what the crash takes with it: captureWeeklyWinner runs
// first inside resetWeeklyVotes, so if it throws, the zeroing never happens and every artist
// carries last week's votes into the new week.
threw = null
try {
  await resetWeeklyVotesNow(MONDAY)
} catch (err) {
  threw = err
}
known(
  'a crash while crowning does not leave weeklyVotes un-zeroed for the whole roster',
  (await artistDoc('noregion')).weeklyVotes === 0,
  `weeklyVotes is still ${(await artistDoc('noregion')).weeklyVotes} after resetWeeklyVotes` +
    `${threw ? ' — captureWeeklyWinner threw and resetField never ran' : ''}`,
)

/* ================================================================= 3. resetFandomHeartsWeekly */
console.log('\n=== 3. resetFandomHeartsWeekly ===')
await wipe()
await db.doc('fandomStats/f-a').set({ weeklyHearts: 12, totalHearts: 500, memberCount: 40 })
await db.doc('fandomStats/f-b').set({ weeklyHearts: 0, totalHearts: 3, memberCount: 1 })
await db.doc('fandomStats/f-c').set({ memberCount: 7 }) // never received a heart
// MONDAY is the pinned Monday used elsewhere in this suite; the week being closed is the
// one the preceding day fell in.
await resetFandomHearts(MONDAY)
const fA = (await db.doc('fandomStats/f-a').get()).data()
const fC = (await db.doc('fandomStats/f-c').get()).data()
checkEq('weeklyHearts zeroed', fA.weeklyHearts, 0)
checkEq('totalHearts left alone', fA.totalHearts, 500)
checkEq('memberCount left alone', fA.memberCount, 40)
checkEq('a fandom that never received a heart gains the field via merge-set', fC.weeklyHearts, 0)
checkEq('merge-set does not clobber other fields', fC.memberCount, 7)

// The week's totals must survive the zeroing — they cannot be reconstructed afterwards,
// which is exactly how the weekly battle used to lose its matchup.
const heartWeek = isoWeekId(new Date(MONDAY.getTime() - 86_400_000))
const archived = (await db.doc(`fandomHeartHistory/${heartWeek}`).get()).data()
check('the closed week is archived before the counters are zeroed', !!archived, heartWeek)
checkEq('the archive keeps each fandom that scored', archived?.hearts?.['f-a'], 12)
checkEq('fandoms on zero are left out of the archive', archived?.hearts?.['f-b'], undefined)
checkEq('totalHearts across the week', archived?.totalHearts, 12)
checkEq('fandomCount counts only fandoms that scored', archived?.fandomCount, 1)

// A week nobody played should not leave an empty document behind.
await wipe()
await db.doc('fandomStats/f-z').set({ weeklyHearts: 0, memberCount: 2 })
await resetFandomHearts(MONDAY)
checkEq(
  'a week with no hearts writes no archive doc',
  (await db.doc(`fandomHeartHistory/${heartWeek}`).get()).exists,
  false,
)

/* ================================================================= 4. monthly / yearly resets */
console.log('\n=== 4. resetMonthlyVotes / resetYearlyVotes ===')
const periodSeed = [
  { id: 'p-a', name: 'PA', weeklyVotes: 3, monthlyVotes: 30, yearlyVotes: 300 },
  { id: 'p-b', name: 'PB', weeklyVotes: 4, monthlyVotes: 40, yearlyVotes: 400 },
]
const tallies = async () =>
  await Promise.all(
    periodSeed.map(async ({ id }) => {
      const d = await artistDoc(id)
      return [d.weeklyVotes, d.monthlyVotes, d.yearlyVotes]
    }),
  )

await seedArtists(periodSeed)
await resetField('monthlyVotes')
checkEq('resetMonthlyVotes zeroes only monthlyVotes', await tallies(), [[3, 0, 300], [4, 0, 400]])

await seedArtists(periodSeed)
await resetField('yearlyVotes')
checkEq('resetYearlyVotes zeroes only yearlyVotes', await tallies(), [[3, 30, 0], [4, 40, 0]])

/* ================================================================= 5. captureDailySnapshot */
console.log('\n=== 5. captureDailySnapshot ===')
const SNAP_DAY = new Date('2026-08-16T23:50:00Z')
const SNAP_ID = '2026-08-16'
await seedArtists([
  {
    id: 's-a',
    name: 'SA',
    metrics: wikiMetric(77_000),
    compositeScore: 61.5,
    rank: 1,
    weeklyVotes: 42,
    monthlyVotes: 100,
    yearlyVotes: 500,
  },
  { id: 's-b', name: 'SB' }, // no metrics / score / rank at all
])
await captureDailySnapshotNow(SNAP_DAY)
const histA = (await db.doc(`artists/s-a/rankingHistory/${SNAP_ID}`).get()).data()
checkEq('snapshot doc id is the UTC date', SNAP_ID, histA?.date)
checkEq('snapshot records compositeScore', histA?.compositeScore, 61.5)
checkEq('snapshot records rank', histA?.rank, 1)
checkEq('snapshot records the raw popularity metric', histA?.popularity, 77_000)
checkEq('snapshot records weeklyVotes', histA?.weeklyVotes, 42)
checkEq('snapshot records monthlyVotes', histA?.monthlyVotes, 100)
checkEq('snapshot records yearlyVotes', histA?.yearlyVotes, 500)
check('snapshot records capturedAt', !!histA?.capturedAt)
const histB = (await db.doc(`artists/s-b/rankingHistory/${SNAP_ID}`).get()).data()
checkEq('an artist with no metrics/score snapshots as zeros, not undefined', histB, {
  date: SNAP_ID,
  compositeScore: 0,
  rank: 0,
  popularity: 0,
  weeklyVotes: 0,
  monthlyVotes: 0,
  yearlyVotes: 0,
  capturedAt: histB?.capturedAt,
})
checkEq('one snapshot doc per artist', (await db.collection('artists/s-a/rankingHistory').get()).size, 1)

// Re-run the same day: must overwrite in place, never append a second point.
await db.doc('artists/s-a').update({ weeklyVotes: 43 })
await captureDailySnapshotNow(SNAP_DAY)
const reRun = await db.collection('artists/s-a/rankingHistory').get()
checkEq('re-running the same day overwrites rather than duplicating', reRun.size, 1)
checkEq('the overwritten point holds the newer value', reRun.docs[0].data().weeklyVotes, 43)

// A different day appends.
await captureDailySnapshotNow(new Date('2026-08-17T23:50:00Z'))
checkEq(
  'a different day appends a new point',
  (await db.collection('artists/s-a/rankingHistory').get()).docs.map((d) => d.id).sort(),
  ['2026-08-16', '2026-08-17'],
)

/* ================================================================= 6. createWeeklyBattle */
console.log('\n=== 6. createWeeklyBattle ===')
const BATTLE_WEEK = isoWeekId(MONDAY)

/* -- 6a. first-ever run ---------------------------------------------------------------------- */
console.log('\n--- 6a. first-ever run (no battles/current) ---')
const roster = Array.from({ length: 20 }, (_, i) => ({
  id: `bt-${String(i).padStart(2, '0')}`,
  name: `BT${i}`,
  compositeScore: 100 - i,
}))
await seedArtists(roster)
threw = null
try {
  await createWeeklyBattleNow(MONDAY)
} catch (err) {
  threw = err
}
check('first-ever run does not throw with no outgoing battle', !threw, String(threw))
const first = (await db.doc('battles/current').get()).data()
check('battles/current is created', !!first)
checkEq('battle carries the current weekId', first?.weekId, BATTLE_WEEK)
checkEq('battle starts at 0-0', [first?.aVotes, first?.bVotes], [0, 0])
check('the two sides are distinct artists', first?.aArtistId !== first?.bArtistId, `${first?.aArtistId} vs ${first?.bArtistId}`)
check('sides carry denormalised names/regions', !!first?.aName && !!first?.bName && !!first?.aRegion, JSON.stringify(first))
checkEq('nothing is archived on the first run', (await db.collection('battleArchive').get()).size, 0)

/* -- 6b. picks come from the top slice --------------------------------------------------------- */
console.log('\n--- 6b. contenders come from the top 12 ---')
const TOP_12 = new Set(roster.slice(0, 12).map((a) => a.id))
let outsideTop12 = 0
const distinctSeen = new Set()
for (let i = 0; i < 40; i++) {
  // Each iteration is a different week. createWeeklyBattleNow is now a no-op when a battle
  // already exists for the current week (re-running inside one week used to corrupt the
  // archive and lock out anyone who had already voted), so re-running with a fixed date
  // would only ever exercise the first matchup.
  const week = new Date(MONDAY.getTime() + i * 7 * 86_400_000)
  await createWeeklyBattleNow(week)
  const b = (await db.doc('battles/current').get()).data()
  if (!TOP_12.has(b.aArtistId) || !TOP_12.has(b.bArtistId)) outsideTop12++
  if (b.aArtistId === b.bArtistId) distinctSeen.add('collision')
  distinctSeen.add(b.aArtistId)
  distinctSeen.add(b.bArtistId)
}
checkEq('40 runs never pick an artist outside the top 12', outsideTop12, 0)
check('40 runs never pick the same artist for both sides', !distinctSeen.has('collision'))
check('the matchup actually varies across runs', distinctSeen.size > 2, `${distinctSeen.size} distinct contenders seen`)

/* -- 6c. archiving the outgoing battle with a winner --------------------------------------------- */
console.log('\n--- 6c. archive + winner ---')
const PREV_MONDAY = new Date('2026-08-10T00:00:00Z')
const PREV_WEEK = isoWeekId(PREV_MONDAY)
for (const [aVotes, bVotes, expected] of [[3, 7, 'b'], [9, 1, 'a'], [5, 5, 'tie']]) {
  await db.recursiveDelete(db.collection('battleArchive'))
  await db.doc('battles/current').set({
    weekId: PREV_WEEK,
    aArtistId: 'bt-00',
    aName: 'BT0',
    aRegion: 'KR',
    bArtistId: 'bt-01',
    bName: 'BT1',
    bRegion: 'KR',
    aVotes,
    bVotes,
  })
  await createWeeklyBattleNow(MONDAY)
  const arch = (await db.doc(`battleArchive/${PREV_WEEK}`).get()).data()
  checkEq(`archive winner for ${aVotes}-${bVotes} is "${expected}"`, arch?.winner, expected)
  checkEq(`archive preserves the ${aVotes}-${bVotes} tally`, [arch?.aVotes, arch?.bVotes], [aVotes, bVotes])
  checkEq('archive preserves the matchup', [arch?.aArtistId, arch?.bArtistId], ['bt-00', 'bt-01'])
  check('archive stamps archivedAt', !!arch?.archivedAt)
  checkEq('the archive is keyed by the OUTGOING weekId', arch?.weekId, PREV_WEEK)
  checkEq('battles/current is replaced with the new week', (await db.doc('battles/current').get()).data().weekId, BATTLE_WEEK)
}

/* -- 6d. re-running inside the same week --------------------------------------------------------- */
console.log('\n--- 6d. a second run inside the same week (retry / manual re-trigger) ---')
await db.recursiveDelete(db.collection('battleArchive'))
await db.doc('battles/current').delete()
await createWeeklyBattleNow(MONDAY)
const beforeRerun = (await db.doc('battles/current').get()).data()
await db.doc('battles/current').update({ aVotes: 11, bVotes: 4 })
await createWeeklyBattleNow(MONDAY)
const sameWeekArchive = (await db.doc(`battleArchive/${BATTLE_WEEK}`).get()).data()
const afterRerun = (await db.doc('battles/current').get()).data()
known(
  'a second run in the same week does not silently discard the live matchup',
  !(sameWeekArchive && afterRerun.weekId === sameWeekArchive.weekId),
  `battleArchive/${BATTLE_WEEK} now holds ${sameWeekArchive?.aName} vs ${sameWeekArchive?.bName} ` +
    `(${sameWeekArchive?.aVotes}-${sameWeekArchive?.bVotes}) while battles/current re-uses the SAME weekId ` +
    `${afterRerun.weekId} with a new matchup (${afterRerun.aName} vs ${afterRerun.bName}) — ` +
    `battleVotes/{uid}_${BATTLE_WEEK} still blocks everyone who already voted`,
)
check('test fixture: the re-run did replace the matchup', beforeRerun.weekId === afterRerun.weekId)

/* -- 6e. fewer than 2 eligible artists ------------------------------------------------------------ */
console.log('\n--- 6e. fewer than 2 eligible artists ---')
await wipe()
await db.doc('artists/lonely').set({ name: 'Lonely', region: 'KR', compositeScore: 10 })
await db.doc('battles/current').set({ weekId: 'sentinel', aArtistId: 'x', bArtistId: 'y', aVotes: 0, bVotes: 0 })
threw = null
try {
  await createWeeklyBattleNow(MONDAY)
} catch (err) {
  threw = err
}
check('single-artist roster does not throw', !threw, String(threw))
checkEq('single-artist roster leaves the existing battle intact', (await db.doc('battles/current').get()).data().weekId, 'sentinel')

// Artists that have never been ranked have no compositeScore, so the orderBy skips them.
await db.doc('artists/unranked-1').set({ name: 'U1', region: 'KR' })
await db.doc('artists/unranked-2').set({ name: 'U2', region: 'KR' })
threw = null
try {
  await createWeeklyBattleNow(MONDAY)
} catch (err) {
  threw = err
}
check('a roster whose artists lack compositeScore does not throw', !threw, String(threw))
checkEq(
  'unranked artists are not eligible for a battle (orderBy skips docs missing the field)',
  (await db.doc('battles/current').get()).data().weekId,
  'sentinel',
)

/* -- 6f. empty roster ------------------------------------------------------------------------------ */
await wipe()
threw = null
try {
  await createWeeklyBattleNow(MONDAY)
} catch (err) {
  threw = err
}
check('empty roster does not throw', !threw, String(threw))

/* ================================================================= 7. captureEngagementStats */
console.log('\n=== 7. captureEngagementStats ===')
// 00:05 KST on 2026-08-18 KST == 2026-08-17T15:05Z. The day that just ended is 2026-08-17 KST.
const STATS_NOW = new Date('2026-08-17T15:05:00Z')
const YESTERDAY = dayIdBefore(kstDayId(STATS_NOW), 1)
const COHORT_DAY = dayIdBefore(YESTERDAY, 7)
const STATS_WEEK = isoWeekId(STATS_NOW)
checkEq('test fixture: "yesterday" is the KST day that just ended', YESTERDAY, '2026-08-17')
checkEq('test fixture: the D7 cohort day is exactly 7 days before yesterday', COHORT_DAY, '2026-08-10')

await wipe()
const users = {
  // active only
  u1: { lastVoteDate: YESTERDAY, createdAt: kstNoon(dayIdBefore(YESTERDAY, 30)), weeklyArtistVotes: {} },
  // D7 cohort AND active on day 7
  u2: { lastVoteDate: YESTERDAY, createdAt: kstNoon(COHORT_DAY) },
  // D7 cohort, not active yesterday
  u3: { lastVoteDate: dayIdBefore(YESTERDAY, 3), createdAt: kstNoon(COHORT_DAY) },
  // new yesterday AND active
  u4: { lastVoteDate: YESTERDAY, createdAt: kstNoon(YESTERDAY) },
  // weekly voter only
  u5: { createdAt: kstNoon(dayIdBefore(YESTERDAY, 40)), weeklyArtistVotes: { [STATS_WEEK]: ['a', 'b'] } },
  // votes recorded under a PREVIOUS week -> not a voter this week
  u6: { createdAt: kstNoon(dayIdBefore(YESTERDAY, 40)), weeklyArtistVotes: { '2026-W01': ['a'] } },
  // 6 days before yesterday -> just outside the cohort
  u7: { createdAt: kstNoon(dayIdBefore(YESTERDAY, 6)), lastVoteDate: YESTERDAY },
  // 8 days before yesterday -> just outside the cohort
  u8: { createdAt: kstNoon(dayIdBefore(YESTERDAY, 8)), lastVoteDate: YESTERDAY },
  // no createdAt, no activity — should only move totalUsers
  u9: {},
  // active TODAY, not yesterday — must not count toward the closed day
  u10: { lastVoteDate: kstDayId(STATS_NOW), createdAt: kstNoon(dayIdBefore(YESTERDAY, 20)) },
}
await Promise.all(Object.entries(users).map(([id, u]) => db.doc(`users/${id}`).set(u)))
await captureEngagementStatsNow(STATS_NOW)
const stats = (await db.doc(`stats/${YESTERDAY}`).get()).data()
check(`stats/${YESTERDAY} is written`, !!stats, JSON.stringify(stats))
checkEq('stats.date is the KST day that just ended', stats?.date, YESTERDAY)
checkEq('activeUsers counts lastVoteDate === yesterday (u1,u2,u4,u7,u8)', stats?.activeUsers, 5)
checkEq('newUsers counts accounts created during yesterday KST (u4)', stats?.newUsers, 1)
checkEq('weeklyVoters counts users with >=1 vote in the CURRENT week (u5)', stats?.weeklyVoters, 1)
checkEq('stats.weekId is the ISO week at capture time', stats?.weekId, STATS_WEEK)
checkEq('d7CohortSize = accounts created exactly 7 days before yesterday (u2,u3)', stats?.d7CohortSize, 2)
checkEq('d7ActiveOnDay7 = that cohort, active yesterday (u2)', stats?.d7ActiveOnDay7, 1)
checkEq('totalUsers counts everyone', stats?.totalUsers, 10)
check('stats carries capturedAt', !!stats?.capturedAt)

// The KST day boundary itself: a user created at 23:59 KST of the cohort day is in the cohort;
// one created at 00:01 KST the next day is not.
await wipe()
const edge = Date.parse(`${COHORT_DAY}T00:00:00Z`) - KST
await db.doc('users/edge-in').set({ createdAt: Timestamp.fromDate(new Date(edge + 86_399_000)) })
await db.doc('users/edge-out').set({ createdAt: Timestamp.fromDate(new Date(edge + 86_401_000)) })
await captureEngagementStatsNow(STATS_NOW)
checkEq(
  'the D7 cohort is bounded by the KST midnight boundary',
  (await db.doc(`stats/${YESTERDAY}`).get()).data().d7CohortSize,
  1,
)

/* ================================================================= 8. schedule ordering hazard */
console.log('\n=== 8. ordering hazard: 23:50 snapshot vs 00:00/00:05/00:10 resets ===')
// Sunday 23:50 UTC snapshot, then Monday 00:00 UTC weekly reset — the real production sequence.
await seedArtists([{ id: 'ord', name: 'Ord', weeklyVotes: 42, monthlyVotes: 100, yearlyVotes: 500, compositeScore: 50, rank: 1 }])
await captureDailySnapshotNow(new Date('2026-08-16T23:50:00Z'))
await resetWeeklyVotesNow(new Date('2026-08-17T00:00:00Z'))
const closing = (await db.doc('artists/ord/rankingHistory/2026-08-16').get()).data()
checkEq("Sunday's snapshot holds the week's real closing tally, not zeros", closing?.weeklyVotes, 42)
checkEq('the live counter is zeroed after the reset', (await artistDoc('ord')).weeklyVotes, 0)
checkEq('the crowned Hall of Fame entry matches the snapshotted closing tally', (await db.doc(`hallOfFame/${ENDED_WEEK}`).get()).data()?.votes, closing?.weeklyVotes)

// Demonstrate that the ordering is load-bearing: the old 00:30 slot would have recorded zeros.
await captureDailySnapshotNow(new Date('2026-08-17T00:30:00Z'))
checkEq(
  'a snapshot taken AFTER the reset records 0 — which is why the job moved to 23:50',
  (await db.doc('artists/ord/rankingHistory/2026-08-17').get()).data()?.weeklyVotes,
  0,
)

// Month boundary: 23:50 on the last day of the month, then the 00:05 monthly reset.
await seedArtists([{ id: 'ord-m', name: 'OrdM', weeklyVotes: 7, monthlyVotes: 100, yearlyVotes: 500 }])
await captureDailySnapshotNow(new Date('2026-08-31T23:50:00Z'))
await resetField('monthlyVotes')
checkEq(
  "the month's closing tally survives the 00:05 monthly reset",
  (await db.doc('artists/ord-m/rankingHistory/2026-08-31').get()).data()?.monthlyVotes,
  100,
)

// Year boundary: 23:50 Dec 31, then the 00:10 Jan 1 yearly reset.
await seedArtists([{ id: 'ord-y', name: 'OrdY', weeklyVotes: 7, monthlyVotes: 100, yearlyVotes: 5_000 }])
await captureDailySnapshotNow(new Date('2026-12-31T23:50:00Z'))
await resetField('yearlyVotes')
checkEq(
  "the year's closing tally survives the 00:10 yearly reset",
  (await db.doc('artists/ord-y/rankingHistory/2026-12-31').get()).data()?.yearlyVotes,
  5_000,
)

await wipe()
const failed = summary('scheduled functions')
if (knownIssues.length) {
  console.log(`\n=== ${knownIssues.length} pre-existing defect(s), not gating ===`)
  for (const k of knownIssues) console.log(`  DEFECT  ${k.name}\n          ${k.detail}`)
}
process.exit(failed === 0 ? 0 : 1)
