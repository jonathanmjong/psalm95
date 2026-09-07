/**
 * Shared helpers for the emulator end-to-end harness.
 *
 * SAFETY: every entry point calls `assertEmulator()`, which hard-fails unless the Firestore
 * and Auth emulator hosts are set AND the project id is a `demo-` project. A demo project id
 * makes the Firebase SDKs refuse to contact real Google backends at all, so these scripts
 * cannot reach production even if the emulator is down.
 */
import { createRequire } from 'node:module'

// firebase-admin lives in functions/node_modules, not the web app's. Resolve it from there
// rather than adding a root dependency just for the test harness.
const require = createRequire(new URL('../../functions/package.json', import.meta.url))
const { initializeApp, getApps } = require('firebase-admin/app')
export const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
export const { getStorage } = require('firebase-admin/storage')
export const { getAuth } = require('firebase-admin/auth')

export const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-test'
export const FUNCTIONS_ORIGIN = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`
export const AUTH_ORIGIN = 'http://127.0.0.1:9099'

export function assertEmulator() {
  if (!PROJECT_ID.startsWith('demo-')) {
    throw new Error(`Refusing to run against non-demo project "${PROJECT_ID}".`)
  }
  for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[v]) throw new Error(`${v} is not set — refusing to run outside the emulator.`)
  }
}

export function adminApp() {
  if (getApps().length) return getApps()[0]
  return initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` })
}

/** Creates (or reuses) an Auth-emulator user and returns { uid, idToken, email }. */
export async function createUser(email, password, displayName) {
  const key = 'fake-api-key'
  const base = `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1`
  let res = await fetch(`${base}/accounts:signUp?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true, displayName }),
  })
  let body = await res.json()
  if (!res.ok) {
    res = await fetch(`${base}/accounts:signInWithPassword?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
    body = await res.json()
    if (!res.ok) throw new Error(`auth failed for ${email}: ${JSON.stringify(body)}`)
  }
  return { uid: body.localId, idToken: body.idToken, email, password }
}

export async function freshToken(email, password) {
  const res = await fetch(
    `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const body = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(body))
  return body.idToken
}

/**
 * Invokes an onCall function on the Functions emulator over HTTP, exactly the way the
 * firebase/functions client does. Returns { ok, data, error } — `error` carries the
 * HttpsError `status` (e.g. "already-exists") and message.
 */
export async function callFn(name, data, idToken) {
  const res = await fetch(`${FUNCTIONS_ORIGIN}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data: data ?? null }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    return { ok: false, error: { status: body.error?.status, message: body.error?.message, http: res.status } }
  }
  return { ok: true, data: body.result }
}

/* ------------------------------------------------------------------ assertions */
export const results = []

export function check(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return !!pass
}

export function checkEq(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  return check(name, a === e, `got ${a}, expected ${e}`)
}

export function summary(label) {
  const failed = results.filter((r) => !r.pass)
  console.log(`\n=== ${label}: ${results.length - failed.length}/${results.length} passed ===`)
  for (const f of failed) console.log(`  FAIL  ${f.name} — ${f.detail}`)
  return failed.length
}
