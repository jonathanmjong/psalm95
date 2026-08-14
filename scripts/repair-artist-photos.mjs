#!/usr/bin/env node
/**
 * Repairs artist photos in the live Firestore project.
 *
 * Background: the original seeder found photos with a free-text Wikimedia Commons search
 * on the artist's name, so acronyms and common words matched unrelated files (iKON ->
 * "John_the_Baptist_icon", IVE -> "Institute of Vocational Education", BTS -> Bratislava
 * Airport, f(x) -> a maths graph). This script re-derives every artist's photos with the
 * identity-based resolver in functions/src/seed/wikimedia.ts (Wikidata entity -> P18 /
 * Commons category / linked article) and reconciles Firestore against that result.
 *
 * Rules:
 *   - `source: 'wikimedia-seed'` docs NOT in the newly verified set are deleted.
 *   - Verified images missing from Firestore are inserted.
 *   - Duplicate seeded docs for the same URL are collapsed to one.
 *   - `source: 'user-upload'` (and anything that is not 'wikimedia-seed') is NEVER touched.
 *   - An artist whose identity cannot be verified ends up with ZERO seeded photos rather
 *     than wrong ones. The UI already renders a gradient avatar in that case.
 *
 * Usage:
 *   npm --prefix functions run build            # the resolver is read from functions/lib
 *   node scripts/repair-artist-photos.mjs                     # dry run (default)
 *   node scripts/repair-artist-photos.mjs --artist=ikon       # single artist
 *   node scripts/repair-artist-photos.mjs --apply             # write changes
 *
 * Auth: application default credentials against project jj-psalm95, the same pattern used
 * by functions/src/seed/run.ts and functions/src/seed/bios/apply.ts. Run
 * `gcloud auth application-default login` first if you have not already.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'jj-psalm95'

// firebase-admin and the compiled resolver both live under functions/.
const functionsRequire = createRequire(resolve(here, '../functions/package.json'))
const resolverPath = resolve(here, '../functions/lib/seed/wikimedia.js')
if (!existsSync(resolverPath)) {
  console.error(
    `Missing ${resolverPath}.\nBuild the functions package first:\n  npm --prefix functions run build`,
  )
  process.exit(1)
}

const { fetchArtistPhotos } = functionsRequire(resolverPath)
const { initializeApp, applicationDefault } = functionsRequire('firebase-admin/app')
const { getFirestore, FieldValue } = functionsRequire('firebase-admin/firestore')

// --- args ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const onlyArtist = args.find((a) => a.startsWith('--artist='))?.slice('--artist='.length)
const verbose = args.includes('--verbose')
const unknown = args.filter(
  (a) => !['--apply', '--dry-run', '--verbose'].includes(a) && !a.startsWith('--artist='),
)
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}`)
  console.error('Usage: node scripts/repair-artist-photos.mjs [--dry-run|--apply] [--artist=<id>] [--verbose]')
  process.exit(1)
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

const SEED_SOURCE = 'wikimedia-seed'

function pictureDoc(artistId, image) {
  return {
    artistId,
    url: image.url,
    storagePath: null,
    uploadedBy: 'seed',
    uploadedAt: FieldValue.serverTimestamp(),
    taggedArtists: [artistId],
    taggedMembers: [],
    taggedMemberKeys: [],
    source: SEED_SOURCE,
    attribution: {
      author: image.author,
      license: image.license,
      sourceUrl: image.sourceUrl,
    },
    voteCount: 0,
  }
}

/**
 * Comparison key for a picture URL. Older seeded docs carry Commons' `?utm_*` tracking
 * params; ignoring the query string keeps a still-valid photo from being deleted and
 * re-inserted for a cosmetic difference.
 */
function urlKey(url) {
  return String(url ?? '').split('?')[0]
}

/** Short label for logging a stored picture: the Commons filename when we can derive it. */
function shortName(url) {
  try {
    return decodeURIComponent(urlKey(url).split('/').pop() ?? url)
  } catch {
    return url
  }
}

async function repairArtist(doc) {
  const artist = doc.data()
  const ref = doc.ref
  const picturesRef = ref.collection('pictures')
  const snapshot = await picturesRef.get()

  const seeded = []
  let untouched = 0
  for (const picture of snapshot.docs) {
    if (picture.get('source') === SEED_SOURCE) seeded.push(picture)
    else untouched++
  }

  const result = await fetchArtistPhotos({
    id: doc.id,
    name: artist.name,
    region: artist.region,
    type: artist.type,
    spotifyArtistId: artist.spotifyArtistId ?? null,
  })

  const verified = new Map(result.images.map((image) => [urlKey(image.url), image]))

  // Keep at most one existing doc per verified URL; everything else seeded goes.
  const keptUrls = new Set()
  const toKeep = []
  const toDelete = []
  for (const picture of seeded) {
    const key = urlKey(picture.get('url'))
    if (verified.has(key) && !keptUrls.has(key)) {
      keptUrls.add(key)
      toKeep.push(picture)
    } else {
      toDelete.push(picture)
    }
  }
  const toAdd = result.images.filter((image) => !keptUrls.has(urlKey(image.url)))

  const entity = result.entity
  console.log(`\n${doc.id}  (${artist.name})`)
  console.log(
    `  entity  : ${
      entity
        ? `${entity.qid} "${entity.label}"${entity.description ? ` — ${entity.description}` : ''} [score ${entity.score}]`
        : 'UNRESOLVED'
    }`,
  )
  if (entity) console.log(`  evidence: ${entity.reasons.join('; ')}`)
  console.log(`  note    : ${result.note}`)
  console.log(
    `  before  : ${seeded.length} seeded + ${untouched} user/other` +
      `   after: ${toKeep.length + toAdd.length} seeded + ${untouched} user/other`,
  )
  console.log(`  delete  : ${toDelete.length}   keep: ${toKeep.length}   add: ${toAdd.length}`)
  if (verbose || toDelete.length > 0) {
    for (const picture of toDelete.slice(0, verbose ? 999 : 5)) {
      console.log(`    - DEL ${shortName(picture.get('url'))}`)
    }
    if (!verbose && toDelete.length > 5) console.log(`    - ... ${toDelete.length - 5} more`)
  }
  for (const image of toAdd.slice(0, verbose ? 999 : 5)) {
    console.log(`    + ADD ${image.title} (${image.license})`)
  }
  if (!verbose && toAdd.length > 5) console.log(`    + ... ${toAdd.length - 5} more`)

  if (apply) {
    let batch = db.batch()
    let ops = 0
    const flush = async () => {
      if (ops === 0) return
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
    for (const picture of toDelete) {
      batch.delete(picture.ref)
      if (++ops >= 400) await flush()
    }
    for (const image of toAdd) {
      batch.set(picturesRef.doc(), pictureDoc(doc.id, image))
      if (++ops >= 400) await flush()
    }
    await flush()
  }

  return {
    id: doc.id,
    name: artist.name,
    resolved: Boolean(entity),
    entity,
    note: result.note,
    before: seeded.length,
    after: toKeep.length + toAdd.length,
    deleted: toDelete.length,
    added: toAdd.length,
    untouched,
  }
}

async function main() {
  console.log(
    `Mode: ${apply ? 'APPLY (writes to Firestore)' : 'DRY RUN (no writes)'} | project ${PROJECT_ID}` +
      (onlyArtist ? ` | artist ${onlyArtist}` : ''),
  )

  let docs
  if (onlyArtist) {
    const single = await db.doc(`artists/${onlyArtist}`).get()
    if (!single.exists) {
      console.error(`No artist doc "artists/${onlyArtist}".`)
      process.exit(1)
    }
    docs = [single]
  } else {
    docs = (await db.collection('artists').orderBy('__name__').get()).docs
  }
  console.log(`${docs.length} artist(s) to process.`)

  const results = []
  for (const doc of docs) {
    try {
      results.push(await repairArtist(doc))
    } catch (err) {
      console.error(`\n${doc.id}: FAILED — ${err instanceof Error ? err.message : err}`)
      results.push({
        id: doc.id,
        name: doc.get('name'),
        resolved: false,
        note: `error: ${err instanceof Error ? err.message : err}`,
        before: 0,
        after: 0,
        deleted: 0,
        added: 0,
        untouched: 0,
        failed: true,
      })
    }
  }

  const resolved = results.filter((r) => r.resolved)
  const withPhotos = results.filter((r) => r.after > 0)
  const unresolved = results.filter((r) => !r.resolved)
  const resolvedButEmpty = results.filter((r) => r.resolved && r.after === 0)

  console.log('\n' + '='.repeat(78))
  console.log(`SUMMARY (${apply ? 'APPLIED' : 'DRY RUN'})`)
  console.log('='.repeat(78))
  console.log(`artists processed          : ${results.length}`)
  console.log(`resolved to a Wikidata entity: ${resolved.length}`)
  console.log(`ending with >=1 photo      : ${withPhotos.length}`)
  console.log(`seeded photos before       : ${results.reduce((n, r) => n + r.before, 0)}`)
  console.log(`seeded photos after        : ${results.reduce((n, r) => n + r.after, 0)}`)
  console.log(`photos to delete           : ${results.reduce((n, r) => n + r.deleted, 0)}`)
  console.log(`photos to add              : ${results.reduce((n, r) => n + r.added, 0)}`)
  console.log(`user uploads left untouched: ${results.reduce((n, r) => n + r.untouched, 0)}`)

  if (unresolved.length > 0) {
    console.log(`\nUNRESOLVED — will end up with no photos (${unresolved.length}):`)
    for (const r of unresolved) console.log(`  - ${r.id} (${r.name}): ${r.note}`)
  }
  if (resolvedButEmpty.length > 0) {
    console.log(`\nRESOLVED BUT NO FREELY-LICENSED PHOTO (${resolvedButEmpty.length}):`)
    for (const r of resolvedButEmpty) console.log(`  - ${r.id} (${r.name}): ${r.note}`)
  }
  if (!apply) console.log('\nNothing was written. Re-run with --apply to commit these changes.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
