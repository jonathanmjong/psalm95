import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { generations } from './generations'
import { artistSeeds } from './artists'
import { fetchWikimediaImages, throttle } from './wikimedia'
import type { MetricValue } from '../types'

const PROJECT_ID = 'jj-psalm95'

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

function emptyMetric(source: string): MetricValue {
  return { value: 0, source, updatedAt: new Date().toISOString(), stale: true }
}

async function seedGenerations() {
  await db.doc('config/generations').set({ list: generations })
  console.log(`Seeded ${generations.length} generations.`)
}

async function seedArtist(artist: (typeof artistSeeds)[number]) {
  const ref = db.collection('artists').doc(artist.id)
  const existing = await ref.get()

  // Structural fields (name/members/agency/etc.) are always kept in sync with the
  // source-of-truth list. Live data (metrics/votes/compositeScore/rank) is only
  // initialized for brand-new artists — re-running seed must never wipe real
  // Spotify popularity, cast votes, or the computed ranking for existing artists.
  const structural = {
    name: artist.name,
    region: artist.region,
    type: artist.type,
    generationId: artist.generationId,
    members: artist.members,
    spotifyArtistId: artist.spotifyArtistId ?? null,
    agency: artist.agency ?? null,
    influences: artist.influences ?? [],
  }

  if (existing.exists) {
    await ref.set(structural, { merge: true })
  } else {
    await ref.set({
      ...structural,
      metrics: {
        popularity: emptyMetric('unassigned'),
        discography: emptyMetric('unassigned'),
        ticketSales: emptyMetric('unassigned'),
      },
      weeklyVotes: 0,
      monthlyVotes: 0,
      yearlyVotes: 0,
      compositeScore: 0,
      rank: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
  }

  const picturesRef = ref.collection('pictures')

  // Idempotency: drop previously seeded Wikimedia pictures before re-adding,
  // so re-running the seed script doesn't pile up duplicates.
  const existingSeeded = await picturesRef.where('source', '==', 'wikimedia-seed').get()
  await Promise.all(existingSeeded.docs.map((doc) => doc.ref.delete()))

  // Identity-resolved (Wikidata) photos. Passing the whole seed record — not just the
  // name — is what lets the resolver verify the entity via Spotify id / region / type
  // instead of text-matching the name against Commons filenames.
  const images = await fetchWikimediaImages({
    id: artist.id,
    name: artist.name,
    region: artist.region,
    type: artist.type,
    spotifyArtistId: artist.spotifyArtistId ?? null,
  })
  for (const image of images) {
    await picturesRef.add({
      artistId: artist.id,
      url: image.url,
      storagePath: null,
      uploadedBy: 'seed',
      uploadedAt: FieldValue.serverTimestamp(),
      taggedArtists: [artist.id],
      taggedMembers: [],
      taggedMemberKeys: [],
      source: 'wikimedia-seed',
      attribution: {
        author: image.author,
        license: image.license,
        sourceUrl: image.sourceUrl,
      },
      voteCount: 0,
    })
  }

  console.log(`Seeded ${artist.name} (${images.length} Wikimedia image${images.length === 1 ? '' : 's'}).`)
}

async function main() {
  await seedGenerations()
  for (const artist of artistSeeds) {
    await seedArtist(artist)
    await throttle()
  }
  console.log('Seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
