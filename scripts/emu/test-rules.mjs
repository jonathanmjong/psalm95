#!/usr/bin/env node
/**
 * Firestore security-rules tests, exercised through the *client* SDK as a real signed-in
 * non-admin user — the same surface a browser has. Covers the comments flow (flow 7) and
 * the direct-write denials (flow 8).
 *
 *   source scripts/emu/env.sh && node scripts/emu/seed.mjs && node scripts/emu/test-rules.mjs
 */
import { initializeApp } from 'firebase/app'
import { setLogLevel } from 'firebase/firestore'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { assertEmulator, adminApp, createUser, check, summary, getFirestore as adminFs } from './lib.mjs'

setLogLevel('silent') // expected permission-denied errors are noise, not signal
assertEmulator()
adminApp()
const admin = adminFs()

const me = await createUser('tester@example.com', 'password123', 'Test Fan')
const other = await createUser('other@example.com', 'password123', 'Other Fan')

function client(name) {
  const app = initializeApp({ projectId: 'demo-test', apiKey: 'fake-api-key' }, name)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  return { auth, db }
}

const mine = client('me')
const theirs = client('other')
await signInWithEmailAndPassword(mine.auth, me.email, me.password)
await signInWithEmailAndPassword(theirs.auth, other.email, other.password)

/** Runs a write and reports whether it was denied. */
async function denied(name, fn) {
  try {
    await fn()
    return check(name, false, 'write was ALLOWED but should have been denied')
  } catch (err) {
    const code = err?.code ?? String(err)
    return check(name, String(code).includes('permission-denied'), `code=${code}`)
  }
}
async function allowed(name, fn) {
  try {
    await fn()
    return check(name, true)
  } catch (err) {
    return check(name, false, `denied unexpectedly: ${err?.code ?? err}`)
  }
}

/* -------------------------------------------------- fixture state via Admin SDK */
await admin.doc(`users/${me.uid}`).set({
  displayName: 'Test Fan',
  photoURL: null,
  email: me.email,
  weeklyArtistVotes: {},
  activeUploadCount: 0,
  totalVotes: 7,
  currentStreak: 4,
  longestStreak: 9,
  streakFreezes: 1,
  lastVoteDate: '2026-08-15',
  handle: 'testfan',
  acquisitionSource: 'organic',
  referralCount: 0,
})
await admin.doc(`users/${other.uid}`).set({ displayName: 'Other Fan', weeklyArtistVotes: {}, activeUploadCount: 0 })
await admin.doc('fandomStats/aurora').set({ memberCount: 3, weeklyHearts: 2, totalHearts: 5 })
await admin.doc('profiles/' + me.uid).set({ handle: 'testfan', totalVotes: 7 })
await admin.doc('handles/testfan').set({ uid: me.uid })

/* ================================================================= 7. COMMENTS */
console.log('\n--- Flow 7: comments ---')

// Live listener, so "appears live" is actually observed rather than assumed.
const seen = []
const stopListening = onSnapshot(collection(mine.db, 'artists', 'aurora', 'comments'), (snap) => {
  seen.push(snap.docs.map((d) => d.data().text))
})
await new Promise((r) => setTimeout(r, 800))

let myCommentRef = null
await allowed('post a comment as myself', async () => {
  myCommentRef = await addDoc(collection(mine.db, 'artists', 'aurora', 'comments'), {
    uid: me.uid,
    displayName: 'Test Fan',
    photoURL: null,
    text: 'first!',
    createdAt: serverTimestamp(),
  })
})

await new Promise((r) => setTimeout(r, 1200))
check('comment appears live on the snapshot listener', seen.some((s) => s.includes('first!')), `snapshots=${JSON.stringify(seen)}`)

// Another user's comment, created via their own client so ownership is genuine.
const theirComment = await addDoc(collection(theirs.db, 'artists', 'aurora', 'comments'), {
  uid: other.uid,
  displayName: 'Other Fan',
  photoURL: null,
  text: 'theirs',
  createdAt: serverTimestamp(),
})

await denied("cannot delete another user's comment", () =>
  deleteDoc(doc(mine.db, 'artists', 'aurora', 'comments', theirComment.id)),
)
await denied('cannot post a comment attributed to someone else', () =>
  addDoc(collection(mine.db, 'artists', 'aurora', 'comments'), {
    uid: other.uid,
    text: 'impersonation',
    createdAt: serverTimestamp(),
  }),
)
await denied('cannot post a comment over 500 chars', () =>
  addDoc(collection(mine.db, 'artists', 'aurora', 'comments'), {
    uid: me.uid,
    text: 'x'.repeat(501),
    createdAt: serverTimestamp(),
  }),
)
await denied('cannot post an empty comment', () =>
  addDoc(collection(mine.db, 'artists', 'aurora', 'comments'), {
    uid: me.uid,
    text: '',
    createdAt: serverTimestamp(),
  }),
)
await denied("cannot edit another user's comment", () =>
  updateDoc(doc(mine.db, 'artists', 'aurora', 'comments', theirComment.id), { text: 'edited' }),
)
await denied('cannot edit even my own comment', () =>
  updateDoc(doc(mine.db, 'artists', 'aurora', 'comments', myCommentRef.id), { text: 'edited' }),
)
await allowed('can delete my own comment', () =>
  deleteDoc(doc(mine.db, 'artists', 'aurora', 'comments', myCommentRef.id)),
)
stopListening()

/* ================================================================= 8. RULES */
console.log('\n--- Flow 8: direct-write denials ---')

await denied('cannot write artist vote counters directly', () =>
  updateDoc(doc(mine.db, 'artists', 'aurora'), { weeklyVotes: 9999 }),
)
await denied('cannot write artist compositeScore/rank directly', () =>
  updateDoc(doc(mine.db, 'artists', 'aurora'), { compositeScore: 9999, rank: 1 }),
)
await denied('cannot create an artist doc', () => setDoc(doc(mine.db, 'artists', 'fake-artist'), { name: 'Fake' }))
await denied('cannot write fandomStats', () =>
  updateDoc(doc(mine.db, 'fandomStats', 'aurora'), { memberCount: 9999 }),
)
await denied('cannot create fandomStats for a new artist', () =>
  setDoc(doc(mine.db, 'fandomStats', 'nova'), { memberCount: 500 }),
)
await denied('cannot create a picture doc directly', () =>
  addDoc(collection(mine.db, 'artists', 'aurora', 'pictures'), {
    artistId: 'aurora',
    uploadedBy: me.uid,
    storagePath: 'x',
    url: 'x',
    voteCount: 0,
  }),
)
await denied('cannot bump a picture voteCount directly', async () => {
  const ref = admin.collection('artists/aurora/pictures').doc()
  await ref.set({ artistId: 'aurora', uploadedBy: me.uid, voteCount: 0 })
  await updateDoc(doc(mine.db, 'artists', 'aurora', 'pictures', ref.id), { voteCount: 9999 })
})
await denied("cannot write another user's doc", () =>
  updateDoc(doc(mine.db, 'users', other.uid), { displayName: 'hacked' }),
)
await denied("cannot read another user's doc", () => getDoc(doc(theirs.db, 'users', me.uid)))
await denied('cannot write the public profiles projection', () =>
  updateDoc(doc(mine.db, 'profiles', me.uid), { totalVotes: 9999 }),
)
await denied('cannot claim a handle by writing handles/ directly', () =>
  setDoc(doc(mine.db, 'handles', 'freehandle'), { uid: me.uid }),
)
await denied('cannot write hallOfFame', () => setDoc(doc(mine.db, 'hallOfFame', '2026-W33'), { x: 1 }))
await denied('cannot write config', () => setDoc(doc(mine.db, 'config', 'generations'), { x: 1 }))
await denied('cannot write battles', () => setDoc(doc(mine.db, 'battles', 'current'), { aVotes: 999 }))
await denied('cannot write rankingHistory', () =>
  setDoc(doc(mine.db, 'artists', 'aurora', 'rankingHistory', '2026-08-16'), { rank: 1 }),
)

console.log('\n--- Flow 8b: frozen fields on my own user doc ---')
const frozen = {
  totalVotes: 9999,
  currentStreak: 9999,
  longestStreak: 9999,
  streakFreezes: 99,
  lastVoteDate: '2030-01-01',
  lastHeartDate: '2030-01-01',
  handle: 'stolenhandle',
  acquisitionSource: 'paid',
  weeklyArtistVotes: { '2026-W33': ['aurora', 'nova', 'zenith'] },
  activeUploadCount: -5,
  pictureHeartsToday: 99,
  pictureHeartsDate: '2030-01-01',
  referredBy: 'someone',
  referralCount: 500,
  biasArtistId: 'aurora',
}
for (const [field, value] of Object.entries(frozen)) {
  await denied(`cannot self-write frozen field "${field}"`, () =>
    updateDoc(doc(mine.db, 'users', me.uid), { [field]: value }),
  )
}
await denied('cannot delete my own user doc', () => deleteDoc(doc(mine.db, 'users', me.uid)))
await denied('cannot overwrite my user doc with setDoc (resets counters)', () =>
  setDoc(doc(mine.db, 'users', me.uid), { displayName: 'Reset', weeklyArtistVotes: {}, activeUploadCount: 0 }),
)

console.log('\n--- Flow 8c: writes that SHOULD be allowed ---')
await allowed('can update my own displayName', () =>
  updateDoc(doc(mine.db, 'users', me.uid), { displayName: 'Renamed Fan' }),
)
await allowed('can update my own photoURL', () =>
  updateDoc(doc(mine.db, 'users', me.uid), { photoURL: 'https://example.com/a.png' }),
)
await allowed('can update my own emailPrefs', () =>
  updateDoc(doc(mine.db, 'users', me.uid), { emailPrefs: { streakReminders: false } }),
)
await allowed('can read my own user doc', () => getDoc(doc(mine.db, 'users', me.uid)))
await allowed('can read a public profile', () => getDoc(doc(theirs.db, 'profiles', me.uid)))
await allowed('can read an artist doc', () => getDoc(doc(mine.db, 'artists', 'aurora')))

const failures = summary('rules + comments')
process.exit(failures === 0 ? 0 : 1)
