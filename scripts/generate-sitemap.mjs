// Generates public/sitemap.xml from the curated artist roster so every indexable route is
// discoverable. Reads artist ids straight out of the seed file (single source of truth)
// rather than duplicating the list. Runs as a build prestep.
//
// Intentionally excluded: /login and /profile (personal/utility pages, nothing to index)
// and /u/<handle> public profiles (opt-in and shareable, but user-generated and not part of
// the curated surface — robots.txt still allows crawling them).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SITE = 'https://psalmtune.com'
const artistsFile = resolve(here, '../functions/src/seed/artists.ts')

const src = readFileSync(artistsFile, 'utf8')
const ids = [...src.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
const uniqueIds = [...new Set(ids)]

const today = new Date().toISOString().slice(0, 10)
const urls = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
  // Live boards: they move every hour, and both have prerendered shells.
  { loc: `${SITE}/fandoms`, priority: '0.9', changefreq: 'daily' },
  { loc: `${SITE}/hall-of-fame`, priority: '0.8', changefreq: 'weekly' },
  ...uniqueIds.map((id) => ({
    loc: `${SITE}/artist/${id}`,
    priority: '0.7',
    changefreq: 'daily',
  })),
  { loc: `${SITE}/about`, priority: '0.4', changefreq: 'monthly' },
  { loc: `${SITE}/privacy`, priority: '0.2', changefreq: 'yearly' },
]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

writeFileSync(resolve(here, '../public/sitemap.xml'), xml)
console.log(`Generated sitemap.xml with ${urls.length} URLs (${uniqueIds.length} artists).`)
