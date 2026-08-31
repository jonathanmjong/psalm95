#!/usr/bin/env node
/**
 * Launch dashboard: which channels sent traffic, which converted, and whether people came
 * back. Reads the aggregate `analytics/{day}` counters and the `stats/{day}` engagement
 * rollup — both are Admin-only, which is why this runs with credentials rather than in the
 * browser.
 *
 * Usage:
 *   node scripts/launch-report.mjs          # last 14 days
 *   node scripts/launch-report.mjs 30       # last 30 days
 *
 * Auth: application default credentials (`gcloud auth application-default login`).
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(resolve(here, '../functions/package.json'))
const { initializeApp, applicationDefault } = req('firebase-admin/app')
const { getFirestore } = req('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'jj-psalm95' })
const db = getFirestore()

const days = Number(process.argv[2] ?? 14)
const [visitsSnap, statsSnap] = await Promise.all([
  db.collection('analytics').orderBy('date', 'desc').limit(days).get(),
  db.collection('stats').orderBy('date', 'desc').limit(days).get(),
])

/**
 * Reads a counter group in either shape. Until 2026-08-31 recordVisit wrote dotted keys via
 * `set({merge:true})`, which Firestore stores as a literal field name ("bySource.direct")
 * rather than a nested map — so those days' numbers are real but flat. Merging both keeps the
 * pre-fix history readable instead of silently reporting zero.
 */
function collect(data, group) {
  const out = { ...(data[group] ?? {}) }
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(`${group}.`)) continue
    const key = k.slice(group.length + 1)
    out[key] = (out[key] ?? 0) + v
  }
  return out
}

const pad = (s, n) => String(s).padEnd(n)
const num = (s, n) => String(s).padStart(n)

if (visitsSnap.empty) {
  console.log('No visit data yet. It starts recording on the next page load after deploy.\n')
} else {
  console.log('\nTRAFFIC BY SOURCE')
  console.log('─'.repeat(64))
  const totals = {}
  const signups = {}
  let visits = 0
  for (const doc of visitsSnap.docs) {
    const d = doc.data()
    visits += d.visits ?? 0
    for (const [k, v] of Object.entries(collect(d, 'bySource'))) totals[k] = (totals[k] ?? 0) + v
    for (const [k, v] of Object.entries(collect(d, 'signupsBySource'))) signups[k] = (signups[k] ?? 0) + v
  }
  console.log(`${pad('source', 16)}${num('visits', 8)}${num('signups', 9)}${num('conv %', 9)}`)
  for (const [src, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    const s = signups[src] ?? 0
    console.log(`${pad(src, 16)}${num(n, 8)}${num(s, 9)}${num(n ? ((s / n) * 100).toFixed(1) : '—', 9)}`)
  }
  console.log('─'.repeat(64))
  console.log(`${pad('TOTAL', 16)}${num(visits, 8)}\n`)

  console.log('LANDING PAGE')
  const landings = {}
  for (const doc of visitsSnap.docs)
    for (const [k, v] of Object.entries(collect(doc.data(), 'byLanding'))) landings[k] = (landings[k] ?? 0) + v
  for (const [k, v] of Object.entries(landings).sort((a, b) => b[1] - a[1]))
    console.log(`  ${pad(k, 14)}${num(v, 6)}`)
  console.log()
}

console.log('ENGAGEMENT (the two numbers that actually matter)')
console.log('─'.repeat(64))
console.log(`${pad('date', 12)}${num('users', 7)}${num('active', 8)}${num('voters/wk', 11)}${num('D7', 8)}`)
for (const doc of [...statsSnap.docs].reverse()) {
  const s = doc.data()
  const d7 = s.d7CohortSize ? `${s.d7ActiveOnDay7}/${s.d7CohortSize}` : '—'
  console.log(
    `${pad(s.date, 12)}${num(s.totalUsers, 7)}${num(s.activeUsers, 8)}${num(s.weeklyVoters, 11)}${num(d7, 8)}`,
  )
}
if (statsSnap.empty) console.log('  (no engagement rollups yet — captureEngagementStats runs 00:05 KST)')
console.log()
