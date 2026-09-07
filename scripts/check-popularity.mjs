#!/usr/bin/env node
/**
 * READ-ONLY verification of the Wikipedia-pageviews popularity metric against the live roster.
 *
 * Runs the exact code path the scheduled job will run — `resolveWikiArticles` + the pageviews
 * provider from functions/src/metrics/providers/wikipediaPopularity.ts — over every artist doc in
 * the production project, and prints what the board would look like under each source.
 *
 * It NEVER writes: no doc updates, no `wikiArticles` cache priming. Everything it learns is
 * printed and thrown away.
 *
 * Usage:
 *   npm --prefix functions run build          # the provider is loaded from functions/lib
 *   node scripts/check-popularity.mjs
 *   node scripts/check-popularity.mjs --artist=newjeans
 *   node scripts/check-popularity.mjs --concurrency=4
 *   node scripts/check-popularity.mjs --json=/tmp/popularity.json
 *
 * Auth: application default credentials against jj-psalm95, same as scripts/repair-artist-photos.mjs.
 */
import { createRequire } from 'node:module'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'jj-psalm95'

const functionsRequire = createRequire(resolve(here, '../functions/package.json'))
const providerPath = resolve(here, '../functions/lib/metrics/providers/wikipediaPopularity.js')
if (!existsSync(providerPath)) {
  console.error(`Missing ${providerPath}.\nBuild the functions package first:\n  npm --prefix functions run build`)
  process.exit(1)
}

const { wikipediaPopularityProvider, resolveWikiArticles, articleViews, pageviewWindow } =
  functionsRequire(providerPath)
const { initializeApp, applicationDefault } = functionsRequire('firebase-admin/app')
const { getFirestore } = functionsRequire('firebase-admin/firestore')

const args = process.argv.slice(2)
const onlyArtist = args.find((a) => a.startsWith('--artist='))?.slice('--artist='.length)
const jsonOut = args.find((a) => a.startsWith('--json='))?.slice('--json='.length)
const concurrency = Number(args.find((a) => a.startsWith('--concurrency='))?.slice('--concurrency='.length)) || 1

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

/** Same window the provider uses, recomputed here only so the header can state it. */
const LAG_DAYS = 3
const WINDOW_DAYS = 30
const stamp = (daysAgo) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function pad(value, width, right = false) {
  const s = String(value ?? '')
  const clipped = s.length > width ? `${s.slice(0, width - 1)}…` : s
  return right ? clipped.padStart(width) : clipped.padEnd(width)
}

async function mapWithConcurrency(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++
        if (i >= items.length) return
        out[i] = await fn(items[i], i)
      }
    }),
  )
  return out
}

async function main() {
  console.log(`READ-ONLY check | project ${PROJECT_ID} | window ${stamp(LAG_DAYS + WINDOW_DAYS - 1)}..${stamp(LAG_DAYS)} (${WINDOW_DAYS}d)`)

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
  console.log(`${docs.length} artist(s), concurrency ${concurrency}.\n`)

  const started = Date.now()
  let done = 0

  const rows = await mapWithConcurrency(docs, concurrency, async (doc) => {
    const data = doc.data()
    const artist = {
      id: doc.id,
      name: data.name,
      region: data.region,
      type: data.type,
      spotifyArtistId: data.spotifyArtistId ?? null,
      // Deliberately NOT reading data.wikiArticles: this run must exercise the cold
      // resolution path, which is the thing under test.
      wikiArticles: null,
    }

    const t0 = Date.now()
    let articles = {}
    let resolveError = null
    try {
      ;({ articles } = await resolveWikiArticles(artist))
    } catch (err) {
      resolveError = err instanceof Error ? err.message : String(err)
    }
    const resolveMs = Date.now() - t0

    // Feed the freshly resolved titles back in as the cache so the provider exercises only its
    // pageview path — otherwise it would resolve the same entity a second time.
    const result =
      Object.keys(articles).length > 0
        ? await wikipediaPopularityProvider.fetch({ ...artist, wikiArticles: articles })
        : { value: 0, stale: true }
    const totalMs = Date.now() - t0

    // Per-wiki split, so the ja-wiki-vs-ko-wiki traffic asymmetry is visible rather than
    // hidden inside the sum. Costs one extra (throttled) call per language.
    const { start, end } = pageviewWindow()
    const perLanguage = {}
    for (const [language, title] of Object.entries(articles)) {
      perLanguage[language] = await articleViews(language, title, start, end)
    }

    done++
    process.stderr.write(`\r  ${done}/${docs.length} (${Math.round((Date.now() - started) / 1000)}s)   `)

    return {
      id: doc.id,
      name: data.name,
      region: data.region,
      articles,
      perLanguage,
      resolveError,
      resolveMs,
      totalMs,
      pageviews: result.stale ? null : result.value,
      currentSource: data.metrics?.popularity?.source ?? null,
      currentValue: data.metrics?.popularity?.value ?? 0,
      storedWikiArticles: data.wikiArticles ?? null,
    }
  })
  process.stderr.write('\r' + ' '.repeat(40) + '\r')
  console.log('')

  const elapsed = (Date.now() - started) / 1000
  const totalResolveMs = rows.reduce((n, r) => n + r.resolveMs, 0)

  // --- ranks --------------------------------------------------------------------------
  const rankBy = (key) => {
    const order = [...rows].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || a.name.localeCompare(b.name))
    return new Map(order.map((r, i) => [r.id, r[key] === null || r[key] === undefined ? null : i + 1]))
  }
  const pvRank = rankBy('pageviews')
  const deezerRank = rankBy('currentValue')

  const table = [...rows].sort((a, b) => (b.pageviews ?? -1) - (a.pageviews ?? -1) || a.name.localeCompare(b.name))

  console.log(
    pad('artist', 24) +
      pad('rgn', 4) +
      pad('resolved article(s)', 46) +
      pad('30d views', 11, true) +
      pad('pv#', 6, true) +
      pad('current(deezer)', 16, true) +
      pad('dz#', 6, true) +
      '  Δrank',
  )
  console.log('-'.repeat(118))
  for (const r of table) {
    const arts = Object.entries(r.articles)
      .map(([lang, title]) => `${lang}:${title}`)
      .join('  ')
    const pr = pvRank.get(r.id)
    const dr = deezerRank.get(r.id)
    const delta = pr && dr ? dr - pr : null
    console.log(
      pad(r.name, 24) +
        pad(r.region ?? '', 4) +
        pad(arts || (r.resolveError ? `ERROR: ${r.resolveError}` : '— UNRESOLVED —'), 46) +
        pad(r.pageviews === null ? 'STALE' : r.pageviews.toLocaleString('en-US'), 11, true) +
        pad(pr ?? '-', 6, true) +
        pad(`${r.currentValue.toLocaleString('en-US')}${r.currentSource === 'deezer' ? '' : `*${r.currentSource}`}`, 16, true) +
        pad(dr ?? '-', 6, true) +
        pad(delta === null ? '' : delta > 0 ? `+${delta}` : String(delta), 8, true),
    )
  }

  // --- checks -------------------------------------------------------------------------
  const byId = new Map(rows.map((r) => [r.id, r]))
  const check = (aId, bId) => {
    const a = byId.get(aId)
    const b = byId.get(bId)
    if (!a || !b) return `  ${aId} vs ${bId}: MISSING FROM ROSTER`
    const pvOk = (a.pageviews ?? -1) > (b.pageviews ?? -1)
    const dzOk = a.currentValue > b.currentValue
    return (
      `  ${a.name} > ${b.name}?  pageviews: ${pvOk ? 'YES' : 'NO'} ` +
      `(${a.pageviews?.toLocaleString('en-US') ?? 'stale'} vs ${b.pageviews?.toLocaleString('en-US') ?? 'stale'})` +
      `   |  deezer today: ${dzOk ? 'YES' : 'NO'} ` +
      `(${a.currentValue.toLocaleString('en-US')} vs ${b.currentValue.toLocaleString('en-US')})`
    )
  }

  console.log('\n' + '='.repeat(118))
  console.log('ORDERING CHECKS')
  console.log('='.repeat(118))
  console.log(check('newjeans', '2ne1'))
  console.log(check('ive', 'rainbow'))

  const unresolved = rows.filter((r) => Object.keys(r.articles).length === 0)
  const stale = rows.filter((r) => r.pageviews === null)
  const enOnly = rows.filter((r) => Object.keys(r.articles).length === 1 && r.articles.en)
  const noEn = rows.filter((r) => Object.keys(r.articles).length > 0 && !r.articles.en)

  console.log('\nRESOLUTION')
  console.log(`  resolved to >=1 article : ${rows.length - unresolved.length}/${rows.length}`)
  console.log(`  usable pageview value   : ${rows.length - stale.length}/${rows.length}`)
  console.log(`  en + regional wiki      : ${rows.length - unresolved.length - enOnly.length - noEn.length}`)
  console.log(`  en only (no regional)   : ${enOnly.length}`)
  console.log(`  regional only (no en)   : ${noEn.length}`)
  if (unresolved.length > 0) {
    console.log(`\n  UNRESOLVED (${unresolved.length}) — these fall back to Deezer:`)
    for (const r of unresolved) console.log(`    - ${r.id} (${r.name})${r.resolveError ? ` [${r.resolveError}]` : ''}`)
  }
  if (stale.length > unresolved.length) {
    console.log(`\n  RESOLVED BUT NO VIEWS (${stale.length - unresolved.length}):`)
    for (const r of stale.filter((r) => Object.keys(r.articles).length > 0)) {
      console.log(`    - ${r.id} (${r.name}): ${JSON.stringify(r.articles)}`)
    }
  }

  // --- risk hunting -------------------------------------------------------------------
  // Titles that smell like a disambiguation/wrong-entity hit, and values that are
  // implausibly small for an act with a real Deezer following.
  console.log('\nRISK CASES')
  const suspiciousTitle = rows.filter((r) =>
    Object.values(r.articles).some((t) => /\((disambiguation|동음이의|曖昧さ回避|消歧義)\)/i.test(t)),
  )
  console.log(`  disambiguation-looking titles: ${suspiciousTitle.length}`)
  for (const r of suspiciousTitle) console.log(`    - ${r.id}: ${JSON.stringify(r.articles)}`)

  const lowViews = rows
    .filter((r) => r.pageviews !== null && r.pageviews < 1000)
    .sort((a, b) => a.pageviews - b.pageviews)
  console.log(`\n  under 1,000 views/30d (verify these are genuinely obscure, not mis-resolved): ${lowViews.length}`)
  for (const r of lowViews) {
    console.log(
      `    - ${pad(r.id, 20)} ${pad(r.pageviews.toLocaleString('en-US'), 7, true)} views  ` +
        `deezer ${pad(r.currentValue.toLocaleString('en-US'), 9, true)}  ${Object.values(r.articles).join(' / ')}`,
    )
  }

  const bigMovers = [...rows]
    .filter((r) => r.pageviews !== null)
    .map((r) => ({ ...r, delta: (deezerRank.get(r.id) ?? 0) - (pvRank.get(r.id) ?? 0) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 15)
  console.log('\n  BIGGEST RANK MOVES (deezer rank -> pageviews rank):')
  for (const r of bigMovers) {
    console.log(
      `    - ${pad(r.name, 24)} #${pad(deezerRank.get(r.id), 4, true)} -> #${pad(pvRank.get(r.id), 4, true)}  (${r.delta > 0 ? '+' : ''}${r.delta})  ${Object.values(r.articles).join(' / ')}`,
    )
  }

  // --- per-wiki mix -------------------------------------------------------------------
  // The known structural risk: summing en + local wiki is only fair if the local wikis are
  // comparably used. Japanese Wikipedia is a mainstream domestic reference; Korean Wikipedia
  // competes with Namu Wiki and is much thinner. If ja contributes a far larger share than ko,
  // the metric systematically favours J-pop over K-pop.
  console.log('\nPER-WIKI MIX (local-language share of each artist total)')
  const byRegion = new Map()
  for (const r of rows) {
    if (r.pageviews === null) continue
    const local = Object.entries(r.perLanguage).find(([lang]) => lang !== 'en')
    const en = r.perLanguage.en ?? 0
    const localViews = local?.[1] ?? 0
    const share = r.pageviews > 0 ? localViews / r.pageviews : 0
    const bucket = byRegion.get(r.region) ?? []
    bucket.push({ ...r, en, localViews, share })
    byRegion.set(r.region, bucket)
  }
  console.log(`  ${pad('region', 8)}${pad('n', 5, true)}${pad('median en', 12, true)}${pad('median local', 14, true)}${pad('median local share', 20, true)}`)
  for (const [region, bucket] of [...byRegion.entries()].sort()) {
    const median = (key) => {
      const sorted = bucket.map((r) => r[key]).sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    console.log(
      `  ${pad(region, 8)}${pad(bucket.length, 5, true)}${pad(Math.round(median('en')).toLocaleString('en-US'), 12, true)}` +
        `${pad(Math.round(median('localViews')).toLocaleString('en-US'), 14, true)}${pad(`${(median('share') * 100).toFixed(0)}%`, 20, true)}`,
    )
  }
  const localHeavy = [...byRegion.values()]
    .flat()
    .sort((a, b) => b.share - a.share)
    .slice(0, 12)
  console.log('\n  most local-wiki-dependent artists (their rank rests on the non-English article):')
  for (const r of localHeavy) {
    console.log(
      `    - ${pad(r.name, 24)}${pad(`${(r.share * 100).toFixed(0)}%`, 6, true)} local  ` +
        `en ${pad(r.en.toLocaleString('en-US'), 8, true)}  local ${pad(r.localViews.toLocaleString('en-US'), 8, true)}  pv#${pvRank.get(r.id)}`,
    )
  }

  // --- cache state / timing -----------------------------------------------------------
  const alreadyCached = rows.filter((r) => r.storedWikiArticles && Object.keys(r.storedWikiArticles).length > 0)
  console.log('\nTIMING (cold path — no wikiArticles cache used)')
  console.log(`  wall clock            : ${elapsed.toFixed(1)}s at concurrency ${concurrency}`)
  console.log(`  summed per-artist work: ${(rows.reduce((n, r) => n + r.totalMs, 0) / 1000).toFixed(1)}s`)
  console.log(`  of which resolution   : ${(totalResolveMs / 1000).toFixed(1)}s`)
  console.log(`  artists already carrying a wikiArticles cache in Firestore: ${alreadyCached.length}`)

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(rows, null, 2))
    console.log(`\nWrote ${jsonOut}`)
  }
  console.log('\nNothing was written to Firestore.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
