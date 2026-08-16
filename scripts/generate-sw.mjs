#!/usr/bin/env node
/**
 * Post-build step that turns the checked-in public/sw.js (already copied to dist/ by Vite)
 * into a build-specific worker: it fills in the precache list, which can only be known
 * after Rollup has emitted its content-hashed filenames, and a BUILD_ID that changes on
 * exactly the deploys whose bytes changed.
 *
 * Runs last in the `build` chain, after scripts/prerender.mjs, so dist/index.html is final.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, '../dist')

const shell = readFileSync(resolve(dist, 'index.html'), 'utf8')

/**
 * Every chunk Rollup emitted, not just the ones index.html preloads. The entry chunks are
 * ~0.93 MB of that and the page downloads them regardless; the remaining ~0.12 MB is the
 * lazy route chunks, and paying it up front is what makes "go offline, then open a route
 * you have not visited" work at all.
 */
const assets = readdirSync(resolve(dist, 'assets'))
  .filter((f) => !f.endsWith('.map'))
  .sort()
  .map((f) => `/assets/${f}`)

/**
 * Icons index.html actually references. og.png and og-image.png are excluded on purpose:
 * 0.79 MB that only social scrapers ever request, and scrapers do not run service workers.
 * sitemap.xml / robots.txt / ads.txt are excluded for the same reason.
 */
const icons = ['/favicon.svg', '/icon-192.png', '/apple-touch-icon.png'].filter((i) =>
  existsSync(resolve(dist, i.slice(1))),
)

// '/' rather than '/index.html': cleanUrls 301s the latter, and Cache.put() rejects a
// redirected response, which would fail install and disable the worker entirely.
const urls = ['/', ...assets, ...icons]

// Asset filenames are content hashes and index.html embeds them, so hashing the list plus
// the shell yields an id that is stable across rebuilds of identical output and different
// the moment anything ships.
const buildId = createHash('sha256').update(urls.join('\n')).update(shell).digest('hex').slice(0, 12)

const target = resolve(dist, 'sw.js')
const source = readFileSync(target, 'utf8')

let out = source.replace(/^const BUILD_ID = .*$/m, `const BUILD_ID = '${buildId}'`)
if (out === source) throw new Error('generate-sw: BUILD_ID placeholder not found in dist/sw.js')

const withUrls = out.replace(
  /^const PRECACHE_URLS = \[\]$/m,
  `const PRECACHE_URLS = ${JSON.stringify(urls, null, 2)}`,
)
if (withUrls === out) throw new Error('generate-sw: PRECACHE_URLS placeholder not found in dist/sw.js')
out = withUrls

writeFileSync(target, out)

const bytes = urls.reduce((sum, u) => {
  const file = resolve(dist, u === '/' ? 'index.html' : u.slice(1))
  return sum + (existsSync(file) ? statSync(file).size : 0)
}, 0)

console.log(
  `Service worker ${buildId}: precaching ${urls.length} files (${(bytes / 1024).toFixed(0)} kB) — ` +
    `app shell + ${assets.length} chunks + ${icons.length} icons.`,
)
