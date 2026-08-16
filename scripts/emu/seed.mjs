#!/usr/bin/env node
/**
 * Seeds the LOCAL Firebase emulator suite with a handful of artists and test users.
 *
 * Emulator-only by construction: it refuses to run unless FIRESTORE_EMULATOR_HOST is set
 * and the project id starts with "demo-", so it can never touch a real project.
 *
 * Usage (from repo root, with emulators running):
 *   node scripts/emu/seed.mjs
 */
import { assertEmulator, adminApp, PROJECT_ID, createUser, getFirestore } from './lib.mjs'

assertEmulator()
adminApp()
const db = getFirestore()

const metric = (value) => ({ value, source: 'seed', updatedAt: new Date().toISOString(), stale: false })

export const ARTISTS = [
  { id: 'aurora', name: 'AURORA', fandomName: 'Auroras', fandomColorHex: '#7C3AED' },
  { id: 'nova', name: 'NOVA', fandomName: 'Novas', fandomColorHex: '#DB2777' },
  { id: 'zenith', name: 'ZENITH', fandomName: 'Zeniths', fandomColorHex: '#0EA5E9' },
  { id: 'lumen', name: 'LUMEN', fandomName: 'Lumens', fandomColorHex: '#F59E0B' },
]

for (const [i, a] of ARTISTS.entries()) {
  await db.doc(`artists/${a.id}`).set({
    ...a,
    region: 'KR',
    type: 'group',
    generationId: 'gen4',
    members: [
      { memberId: `${a.id}-m1`, name: `${a.name} Member One`, birthdate: '2000-03-04' },
      { memberId: `${a.id}-m2`, name: `${a.name} Member Two`, birthdate: '2001-07-15' },
    ],
    metrics: { popularity: metric(80 - i), discography: metric(70 - i), ticketSales: metric(60 - i) },
    weeklyVotes: 0,
    monthlyVotes: 0,
    yearlyVotes: 0,
    compositeScore: 900 - i * 10,
    rank: i + 1,
  })
}

await db.doc('config/generations').set({
  generations: [{ id: 'gen4', label: '4th Gen', region: 'KR', years: '2018–' }],
})

const users = {
  primary: await createUser('tester@example.com', 'password123', 'Test Fan'),
  other: await createUser('other@example.com', 'password123', 'Other Fan'),
}

console.log(JSON.stringify({ projectId: PROJECT_ID, artists: ARTISTS.map((a) => a.id), users }, null, 2))
