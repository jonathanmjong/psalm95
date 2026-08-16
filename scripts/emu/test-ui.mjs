#!/usr/bin/env node
/**
 * Signed-in UI flows, driven in headless Chrome over CDP against a Vite dev server that is
 * pointed at the local emulator suite. Follows the harness pattern in scripts/check-a11y.mjs.
 *
 * Assertions are made on BOTH sides: what the DOM shows, and what actually landed in the
 * emulator's Firestore (read here with the Admin SDK).
 *
 * Prereqs:
 *   1. firebase emulators:start --only auth,firestore,functions,storage --project demo-test
 *   2. npx vite --mode emulator --port 5199
 *   3. source scripts/emu/env.sh && node scripts/emu/seed.mjs
 * Then:
 *   node scripts/emu/test-ui.mjs
 */
import { spawn } from 'node:child_process'
import { assertEmulator, adminApp, createUser, check, checkEq, summary, getFirestore, getStorage, FieldValue } from './lib.mjs'

assertEmulator()
adminApp()
const db = getFirestore()
const getStorageBucket = () => getStorage().bucket()

const BASE = process.env.BASE_URL || 'http://localhost:5199'
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EMAIL = 'uitester@example.com'
const PASSWORD = 'password123'

const me = await createUser(EMAIL, PASSWORD, 'UI Tester')

/* ---------------------------------------------------------------- clean slate */
for (const c of ['users', 'fandomStats', 'handles', 'profiles', 'pictureVotes']) {
  const snap = await db.collection(c).get()
  await Promise.all(snap.docs.map((d) => d.ref.delete()))
}
for (const id of ['aurora', 'nova', 'zenith', 'lumen']) {
  for (const sub of ['comments', 'pictures']) {
    const snap = await db.collection(`artists/${id}/${sub}`).get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  }
  await db.doc(`artists/${id}`).set({ weeklyVotes: 0, monthlyVotes: 0, yearlyVotes: 0 }, { merge: true })
}

/* ---------------------------------------------------------------- CDP harness */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--remote-debugging-port=9334',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=/tmp/psalm95-emu-uiprof-${Date.now()}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)
process.on('exit', () => chrome.kill())

let targets
for (let i = 0; i < 30; i++) {
  try {
    targets = await (await fetch('http://127.0.0.1:9334/json/list')).json()
    if (targets.some((t) => t.type === 'page')) break
  } catch { /* not up yet */ }
  await sleep(500)
}
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
await new Promise((r) => (ws.onopen = r))
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) {
    return { __error: r.result.exceptionDetails.exception?.description ?? 'eval error' }
  }
  return r.result?.result?.value
}
await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Network.enable')
const netFailures = []
const reqUrls = new Map()
const consoleLog = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled') {
    consoleLog.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
  }
  if (m.method === 'Log.entryAdded') consoleLog.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`)
  if (m.method === 'Network.requestWillBeSent') reqUrls.set(m.params.requestId, m.params.request.url)
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
    netFailures.push({ url: m.params.response.url, detail: `HTTP ${m.params.response.status}` })
  }
  if (m.method === 'Network.loadingFailed') {
    netFailures.push({ url: reqUrls.get(m.params.requestId) ?? '?', detail: m.params.errorText })
  }
})

const goto = async (path) => {
  await send('Page.navigate', { url: BASE + path })
  await sleep(3500)
}
/** Waits until `expr` returns truthy, up to `timeout` ms. */
async function waitFor(expr, timeout = 12000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const v = await evalJs(expr)
    if (v && !v.__error) return v
    await sleep(300)
  }
  return null
}
const bodyText = () => evalJs('document.body.innerText')
/** Polls Firestore until `pred(value)` holds, returning { value, ms }. Distinguishes a
 * write that never happened from one that was merely slow. */
async function settle(read, pred, timeout = 25000) {
  const t0 = Date.now()
  let value
  while (Date.now() - t0 < timeout) {
    value = await read()
    if (pred(value)) return { value, ms: Date.now() - t0 }
    await sleep(400)
  }
  return { value, ms: Date.now() - t0, timedOut: true }
}
/** Clicks the first button whose visible text or aria-label matches `re`. */
const clickButton = (re) =>
  evalJs(`(() => {
    const rx = ${re};
    const el = [...document.querySelectorAll('button, a')].find(
      b => rx.test(b.innerText || '') || rx.test(b.getAttribute('aria-label') || '')
    );
    if (!el) return 'notfound';
    if (el.disabled) return 'disabled';
    el.click();
    return 'clicked';
  })()`)

/* ---------------------------------------------------------------- sign in */
await goto('/')
const bootErr = await evalJs('window.__viteError || null')

// Sign in through the app's own Firebase instance. The dev server rewrites bare specifiers,
// so the auth module URL is read out of the transformed source rather than guessed — this
// needs no test-only hook in application code.
const signIn = await evalJs(`(async () => {
  const src = await (await fetch('/src/lib/firebase.ts')).text();
  const m = src.match(/from "([^"]*firebase_auth[^"]*)"/);
  if (!m) return 'no-auth-module';
  const [fb, authMod] = await Promise.all([import('/src/lib/firebase.ts'), import(m[1])]);
  const cred = await authMod.signInWithEmailAndPassword(fb.auth, ${JSON.stringify(EMAIL)}, ${JSON.stringify(PASSWORD)});
  window.__uid = cred.user.uid;
  return cred.user.uid;
})()`)
check('signed in through the app SDK against the Auth emulator', signIn === me.uid, `got ${JSON.stringify(signIn)}${bootErr ? ` bootErr=${bootErr}` : ''}`)
if (signIn !== me.uid) {
  console.error('Cannot continue without a signed-in session.')
  process.exit(1)
}

// The app creates users/{uid} client-side on first auth (ensureUserProfile).
const created = await settle(async () => (await db.doc(`users/${me.uid}`).get()).data(), (d) => !!d)
check('app auto-created users/{uid} on first sign-in (rules allow it)', !!created.value, `after ${created.ms}ms`)
checkEq('new user doc starts with an empty ballot', created.value?.weeklyArtistVotes, {})
checkEq('new user doc starts at 0 uploads', created.value?.activeUploadCount, 0)
checkEq('new user doc starts at 0 votes', created.value?.totalVotes, 0)

await goto('/')
await sleep(2000)

/* ================================================================= daily heart: no fandom */
console.log('\n--- UI: daily heart before joining a fandom ---')
let text = await bodyText()
check('Daily Heart card is on the home page', /Daily Heart/i.test(text))
check('card prompts to pick a fandom first', /Pick a fandom/i.test(text), text.match(/.{0,80}fandom.{0,60}/i)?.[0] ?? '')
check('card offers a "Join a fandom" link instead of a claim button', /Join a fandom/i.test(text))

/* ================================================================= join fandom */
console.log('\n--- UI: join a fandom ---')
await goto('/artist/aurora')
text = await bodyText()
check('artist page rendered', /AURORA/.test(text), text.slice(0, 120).replace(/\n/g, ' | '))

let res = await clickButton('/Join Auroras/i')
checkEq('clicked the join button', res, 'clicked')
const joinedLabel = await waitFor(`/In this fandom/.test(document.body.innerText) ? 'yes' : null`)
check('button flips to "✓ In this fandom"', joinedLabel === 'yes')
checkEq('fandomStats/aurora memberCount = 1', (await db.doc('fandomStats/aurora').get()).data()?.memberCount, 1)
checkEq('users doc biasArtistId set', (await db.doc(`users/${me.uid}`).get()).data()?.biasArtistId, 'aurora')
check('member count is shown next to the button', /1 member/i.test(await bodyText()))

/* ================================================================= vote */
console.log('\n--- UI: voting ---')
res = await clickButton('/^Vote for AURORA$/')
checkEq('clicked the primary vote button', res, 'clicked')
const votedLabel = await waitFor(`/Voted for AURORA/.test(document.body.innerText) ? 'yes' : null`)
check('button becomes "Voted for AURORA"', votedLabel === 'yes')
const receiptSeen = await waitFor(`(document.body.innerText.match(/Vote cast[^\\n]*/) || [null])[0]`, 8000)
check('receipt shows votes remaining', /Vote cast\s*—\s*2 left this week/.test(receiptSeen || ''), receiptSeen ?? 'NO RECEIPT IN DOM')
if (!receiptSeen) {
  const around = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Voted for AURORA/.test(x.innerText)); return b ? b.closest('div.flex.flex-wrap')?.parentElement?.innerText : 'nobtn' })()`)
  console.log('      DOM around the vote button:', JSON.stringify(around))
}
check('vote button is now disabled', (await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Voted for AURORA/.test(x.innerText)); return b ? b.disabled : 'notfound' })()`)) === true)

const artistSettled = await settle(
  async () => (await db.doc('artists/aurora').get()).data(),
  (d) => d?.weeklyVotes === 1,
)
let a = artistSettled.value
checkEq('artist counters incremented by the UI vote', [a?.weeklyVotes, a?.monthlyVotes, a?.yearlyVotes], [1, 1, 1])
console.log(`      (artist counter settled after ${artistSettled.ms}ms${artistSettled.timedOut ? ' — TIMED OUT' : ''})`)
let u = (await db.doc(`users/${me.uid}`).get()).data()
checkEq('user totalVotes = 1', u?.totalVotes, 1)
checkEq('user currentStreak = 1', u?.currentStreak, 1)
console.log('      browser console so far:\n' + consoleLog.map((l) => '        ' + l).join('\n'))

// "Voted" survives a reload — it is read from the profile, not component state.
await goto('/artist/aurora')
check('"Voted" state persists across a reload', /Voted for AURORA/.test(await bodyText()))

/* ================================================================= out of votes */
console.log('\n--- UI: spending the remaining votes ---')
for (const [artist, label] of [['nova', 'NOVA'], ['zenith', 'ZENITH']]) {
  await goto(`/artist/${artist}`)
  const r = await clickButton(`/^Vote for ${label}$/`)
  const ok = await waitFor(`/Voted for ${label}/.test(document.body.innerText) ? 'yes' : null`)
  check(`voted for ${label} (vote ${artist === 'nova' ? 2 : 3})`, r === 'clicked' && ok === 'yes', `click=${r}`)
}
const three = await settle(async () => (await db.doc(`users/${me.uid}`).get()).data(), (d) => d?.totalVotes === 3)
checkEq('user totalVotes = 3', three.value?.totalVotes, 3)

await goto('/artist/lumen')
text = await bodyText()
check('4th artist shows the "No votes left this week" button', /No votes left this week/.test(text))
const outAria = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/No votes left/.test(x.innerText)); return b ? {aria:b.getAttribute('aria-label'), disabled:b.disabled} : null })()`)
check('out-of-votes button stays tappable (not disabled)', outAria?.disabled === false, JSON.stringify(outAria))
res = await clickButton('/No votes left this week/')
await sleep(1200)
text = await bodyText()
check(
  'clicking it explains the limit with a reset countdown',
  /used all 3 of your votes this week/i.test(text) && /You get 3 more in .*\(Monday\)/.test(text),
  text.match(/used all[^\n]*/)?.[0] ?? 'no message',
)
checkEq('no 4th vote reached the server', (await db.doc('artists/lumen').get()).data()?.weeklyVotes, 0)
checkEq('totalVotes still 3', (await db.doc(`users/${me.uid}`).get()).data()?.totalVotes, 3)

/* ================================================================= daily heart claim */
console.log('\n--- UI: claiming the daily heart ---')
await goto('/')
text = await bodyText()
check('claim button is offered now that a fandom is joined', /Claim today’s heart|Claim today's heart/.test(text))
res = await clickButton(`/Claim today.s heart/`)
checkEq('clicked the claim button', res, 'clicked')
const claimed = await waitFor(`/Claimed today/.test(document.body.innerText) ? 'yes' : null`)
check('card flips to "Claimed today ✓"', claimed === 'yes')
let stats = (await db.doc('fandomStats/aurora').get()).data()
checkEq('fandomStats weeklyHearts = 1', stats?.weeklyHearts, 1)
checkEq('fandomStats totalHearts = 1', stats?.totalHearts, 1)
checkEq('lastHeartDate written', typeof (await db.doc(`users/${me.uid}`).get()).data()?.lastHeartDate, 'string')
check('claimed state shows the streak', /day streak/.test(await bodyText()), (await bodyText()).match(/Claimed today[^\n]*/)?.[0] ?? '')

// Reload: still claimed, no second claim button
await goto('/')
text = await bodyText()
check('claimed state persists across reload', /Claimed today/.test(text))
check('no second claim button the same day', !/Claim today.s heart/.test(text))

/* ================================================================= comments */
console.log('\n--- UI: comments ---')
await goto('/artist/aurora')
const typed = await evalJs(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'notextarea';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'Emulator test comment');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return ta.value;
})()`)
checkEq('typed a comment into the box', typed, 'Emulator test comment')
res = await clickButton('/^Post$/')
checkEq('clicked Post', res, 'clicked')
const appeared = await waitFor(`/Emulator test comment/.test(document.body.innerText) ? 'yes' : null`)
check('comment appears live without a reload', appeared === 'yes')
const commentSnap = await db.collection('artists/aurora/comments').get()
checkEq('exactly one comment doc written', commentSnap.size, 1)
checkEq('comment carries my uid', commentSnap.docs[0]?.data()?.uid, me.uid)

res = await clickButton('/^Delete$/')
checkEq('own comment offers a Delete control', res, 'clicked')
const gone = await waitFor(`!/Emulator test comment/.test(document.body.innerText) ? 'yes' : null`)
check('comment disappears live after delete', gone === 'yes')
checkEq('comment doc removed from Firestore', (await db.collection('artists/aurora/comments').get()).size, 0)

// A comment owned by someone else must not offer a Delete control.
await db.collection('artists/aurora/comments').add({
  uid: 'someone-else-uid',
  displayName: 'Another Fan',
  photoURL: null,
  text: 'Not my comment',
  createdAt: FieldValue.serverTimestamp(),
})
await goto('/artist/aurora')
await waitFor(`/Not my comment/.test(document.body.innerText) ? 'yes' : null`)
const deleteControls = await evalJs(`[...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Delete').length`)
check("no Delete control on another user's comment", deleteControls === 0, `found ${deleteControls}`)


/* ================================================================= pictures (UI) */
console.log('\n--- UI: picture upload and hearting ---')
await goto('/artist/aurora')

/** Drives the upload modal: picks a file via CDP, ticks the rights box, submits. */
async function uploadViaUi(fileName) {
  const opened = await clickButton('/Upload picture/i')
  if (opened !== 'clicked') return `open=${opened}`
  await sleep(1200)
  const node = await send('Runtime.evaluate', {
    expression: `document.querySelector('input[type=file]')`,
    objectGroup: 'up',
  })
  const objectId = node.result?.result?.objectId
  if (!objectId) return 'no-file-input'
  await send('DOM.setFileInputFiles', { files: [fileName], objectId })
  await sleep(600)
  await evalJs(`(() => {
    const cb = [...document.querySelectorAll('input[type=checkbox]')][0];
    if (cb && !cb.checked) cb.click();
    return true;
  })()`)
  await sleep(300)
  const clicked = await clickButton('/^Upload$/')
  return clicked
}

// A tiny real JPEG on disk for the file input to pick up.
const fs = await import('node:fs/promises')
const os = await import('node:os')
const pathMod = await import('node:path')
const tmpJpeg = pathMod.join(os.tmpdir(), 'psalm95-emu-upload.jpg')
await fs.writeFile(
  tmpJpeg,
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
    'base64',
  ),
)

let up = await uploadViaUi(tmpJpeg)
checkEq('upload modal accepted the submit', up, 'clicked')
const uploaded = await settle(
  async () => (await db.collection('artists/aurora/pictures').get()).size,
  (n) => n === 1,
)
checkEq('upload created exactly one picture doc', uploaded.value, 1)
const picSnap = (await db.collection('artists/aurora/pictures').get()).docs[0]
checkEq('picture doc records the uploader', picSnap.data().uploadedBy, me.uid)
checkEq('picture doc starts at 0 hearts', picSnap.data().voteCount, 0)
checkEq('activeUploadCount incremented to 1', (await db.doc(`users/${me.uid}`).get()).data()?.activeUploadCount, 1)
check(
  'storagePath is scoped to my uid',
  (picSnap.data().storagePath || '').includes(`/uploads/${me.uid}/`),
  picSnap.data().storagePath,
)

// Fill the remaining two slots server-side, then prove the UI blocks the 4th.
for (const n of [2, 3]) {
  const sp = `artists/aurora/uploads/${me.uid}/filler${n}.jpg`
  await getStorageBucket().file(sp).save(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]), { contentType: 'image/jpeg' })
  await db.collection('artists/aurora/pictures').add({
    artistId: 'aurora',
    storagePath: sp,
    url: `http://127.0.0.1:9199/v0/b/demo-test.appspot.com/o/${encodeURIComponent(sp)}?alt=media`,
    uploadedBy: me.uid,
    uploadedAt: FieldValue.serverTimestamp(),
    voteCount: 0,
    source: 'user-upload',
  })
}
await db.doc(`users/${me.uid}`).set({ activeUploadCount: 3 }, { merge: true })

await goto('/artist/aurora')
await clickButton('/Upload picture/i')
await sleep(1500)
const limitText = await bodyText()
check(
  'UI warns at the 3-upload limit before a 4th is attempted',
  /already have 3 active uploads/i.test(limitText),
  limitText.match(/already have[^\n]*/)?.[0] ?? 'no limit hint',
)
const submitDisabled = await evalJs(
  `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Upload'); return b ? b.disabled : 'notfound' })()`,
)
check('the Upload submit button is disabled at the limit', submitDisabled === true, String(submitDisabled))
checkEq('still exactly 3 pictures', (await db.collection('artists/aurora/pictures').get()).size, 3)
await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Cancel/.test(x.innerText)); if (b) b.click(); return true })()`)
await sleep(500)

// Hearting a picture from the grid
await goto('/artist/aurora')
await sleep(1500)
const heartClicked = await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Vote for this picture');
  if (!b) return 'notfound';
  b.click();
  return 'clicked';
})()`)
checkEq('clicked the heart on a picture', heartClicked, 'clicked')
const hearted = await settle(
  async () => (await db.collection('artists/aurora/pictures').get()).docs.reduce((n, d) => n + (d.data().voteCount || 0), 0),
  (n) => n === 1,
)
checkEq('picture voteCount incremented to 1', hearted.value, 1)
const heartFilled = await waitFor(
  `[...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Voted') ? 'yes' : null`,
)
check('heart button flips to the voted state', heartFilled === 'yes')
checkEq('daily picture-heart quota consumed once', (await db.doc(`users/${me.uid}`).get()).data()?.pictureHeartsToday, 1)

// Re-hearting after a reload is an idempotent no-op, NOT an error, and costs no quota.
await goto('/artist/aurora')
await sleep(1500)
const reheart = await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Vote for this picture');
  if (!b) return 'notfound';
  b.click();
  return 'clicked';
})()`)
await sleep(2500)
const afterReheart = (await db.doc(`users/${me.uid}`).get()).data()
const totalHearts = (await db.collection('artists/aurora/pictures').get()).docs.reduce((n, d) => n + (d.data().voteCount || 0), 0)
checkEq('re-heart did not double-count', totalHearts, 1)
checkEq('re-heart did not consume more quota', afterReheart?.pictureHeartsToday, 1)
check('no error message shown on a re-heart', !/Could not heart/i.test(await bodyText()), `reheart=${reheart}`)

/* ================================================================= handle (UI) */
console.log('\n--- UI: claiming a handle ---')
await goto('/profile')
await sleep(1500)
text = await bodyText()
check('profile page offers a handle claim', /Claim a handle/i.test(text), text.slice(0, 100).replace(/\n/g, ' | '))

async function typeHandle(value) {
  return evalJs(`(() => {
    const el = [...document.querySelectorAll('input')].find(i => i.placeholder === 'yourhandle');
    if (!el) return 'noinput';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  })()`)
}

// Reserved word: the server must reject it and the UI must say so.
await typeHandle('admin')
await clickButton('/^Claim$/')
await sleep(2500)
text = await bodyText()
check('reserved handle rejected with a visible message', /reserved/i.test(text), text.match(/.{0,60}reserved.{0,40}/i)?.[0] ?? 'no message')
check('no handle was written for the reserved attempt', !(await db.doc(`users/${me.uid}`).get()).data()?.handle)

// A valid handle
await typeHandle('uifan')
await clickButton('/^Claim$/')
const claimedHandle = await settle(async () => (await db.doc(`users/${me.uid}`).get()).data()?.handle, (h) => h === 'uifan')
checkEq('valid handle claimed', claimedHandle.value, 'uifan')
const shown = await waitFor(`/You’re @uifan|You're @uifan/.test(document.body.innerText) ? 'yes' : null`)
check('profile card flips to the claimed state', shown === 'yes')
const linkValue = await evalJs(`(() => { const i=[...document.querySelectorAll('input')].find(x=>x.readOnly && /\\/u\\//.test(x.value)); return i ? i.value : null })()`)
check('public link is shown', /psalmtune\.com\/u\/uifan/.test(linkValue || ''), String(linkValue))

const proj = (await db.doc(`profiles/${me.uid}`).get()).data()
check('public projection created by the UI claim', !!proj)
check('projection still leaks no displayName/email/photoURL', !!proj && !('displayName' in proj) && !('email' in proj) && !('photoURL' in proj))
checkEq('projection carries the fandom the user joined', proj?.biasArtistId, 'aurora')


/* ================================================================= optimistic rollback */
// The vote button now shows "Voted" the moment it is clicked, before the server answers
// (see the optimistic `voteState === 'voting'` branch in VoteButton.tsx). That is only safe
// if a server rejection puts the button back. Force a rejection with CDP request
// interception — the one failure mode a happy-path test can never reach.
console.log('\n--- UI: optimistic vote state rolls back on server rejection ---')
await goto('/artist/lumen')
await sleep(1000)

// Give this user a clean ballot so the client believes it has votes to spend.
await db.doc(`users/${me.uid}`).set({ weeklyArtistVotes: {}, totalVotes: 0 }, { merge: true })
await sleep(1500)
await goto('/artist/lumen')
await sleep(1500)

await send('Fetch.enable', { patterns: [{ urlPattern: '*castArtistVote*', requestStage: 'Request' }] })
let intercepted = 0
ws.addEventListener('message', async (e) => {
  const m = JSON.parse(e.data)
  if (m.method !== 'Fetch.requestPaused') return
  const { requestId, request } = m.params
  if (request.method === 'OPTIONS') {
    await send('Fetch.fulfillRequest', {
      requestId,
      responseCode: 204,
      responseHeaders: [
        { name: 'access-control-allow-origin', value: '*' },
        { name: 'access-control-allow-headers', value: '*' },
        { name: 'access-control-allow-methods', value: '*' },
      ],
    })
    return
  }
  intercepted++
  const body = JSON.stringify({
    error: { status: 'RESOURCE_EXHAUSTED', message: 'You have used all 3 votes this week.' },
  })
  await send('Fetch.fulfillRequest', {
    requestId,
    responseCode: 429,
    responseHeaders: [
      { name: 'content-type', value: 'application/json' },
      { name: 'access-control-allow-origin', value: '*' },
    ],
    body: Buffer.from(body).toString('base64'),
  })
})

const beforeClick = await evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Vote for LUMEN/.test(x.innerText)); return b ? b.innerText.trim() : 'notfound' })()`)
checkEq('vote button starts in the unvoted state', beforeClick, 'Vote for LUMEN')

res = await clickButton('/^Vote for LUMEN$/')
checkEq('clicked vote with the server forced to reject', res, 'clicked')

// Optimistic flip should be visible essentially immediately.
const optimistic = await waitFor(`/Voted for LUMEN/.test(document.body.innerText) ? 'yes' : null`, 4000)
check('button optimistically shows the vote as landed', optimistic === 'yes')

// ...and then roll back once the rejection arrives.
const rolledBack = await waitFor(
  `(() => { const b=[...document.querySelectorAll('button')].find(x=>/Vote for LUMEN/.test(x.innerText)); return b ? 'yes' : null })()`,
  10000,
)
check('button rolls back to "Vote for LUMEN" after the rejection', rolledBack === 'yes')
text = await bodyText()
check(
  'the rejection reason is shown to the user',
  /used all 3 votes this week/i.test(text),
  text.match(/.{0,50}votes this week.{0,20}/i)?.[0] ?? 'no error message',
)
check('the intercepted call actually reached the network layer', intercepted > 0, `intercepted=${intercepted}`)
checkEq('no vote was recorded for LUMEN', (await db.doc('artists/lumen').get()).data()?.weeklyVotes, 0)
await send('Fetch.disable')

/* ================================================================= wrap up */
// Two failure classes are expected under the emulator and are NOT app faults:
//  - Firestore's Listen long-poll channel is aborted on every navigation (ERR_ABORTED).
//  - createPictureDoc mints production firebasestorage.googleapis.com URLs (see
//    functions/src/pictures.ts publicUrl), which do not resolve against the emulator, so
//    uploaded images cannot render here. Correct in production, untestable locally.
// Firestore's long-poll channels are aborted on every navigation, and this suite
// deliberately provokes 4xx callable rejections (reserved handle, forced 429), so those are
// signal-free here. What must hold: nothing served by the app itself fails, and no emulator
// returns a 5xx.
const isNavAbort = (f) => /\/google\.firestore\.v1\.Firestore\//.test(f.url) && /ERR_ABORTED/.test(f.detail)
const isDeliberate4xx = (f) => /:5001\//.test(f.url) && /^HTTP 4/.test(f.detail)
const appOriginFailures = netFailures.filter((f) => f.url.startsWith(BASE))
check('no app-origin asset failed to load', appOriginFailures.length === 0, appOriginFailures.map((f) => `${f.detail} ${f.url}`).join(' | '))
const serverErrors = netFailures.filter((f) => /^HTTP 5/.test(f.detail) && !/firebasestorage\.googleapis\.com/.test(f.url))
check('no emulator returned a 5xx', serverErrors.length === 0, [...new Set(serverErrors.map((f) => `${f.detail} ${f.url}`))].slice(0, 4).join(' | '))
// Third-party traffic (the AdSense tag in index.html and everything it pulls in) is out of
// scope here and is aborted freely as pages unmount — only first-party requests are asserted.
const isFirstParty = (f) => f.url.startsWith(BASE) || /127\.0\.0\.1:(5001|8080|9099|9199)/.test(f.url)
const unexplained = netFailures.filter(
  (f) => isFirstParty(f) && !isNavAbort(f) && !isDeliberate4xx(f),
)
check('no unexplained failed requests', unexplained.length === 0, [...new Set(unexplained.map((f) => `${f.detail} ${f.url}`))].slice(0, 6).join(' | '))

ws.close()
chrome.kill()
process.exit(summary('UI flows') === 0 ? 0 : 1)
