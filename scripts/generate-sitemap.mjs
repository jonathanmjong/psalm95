// Generates public/sitemap.xml from the curated artist roster so all artist pages
// are discoverable. Reads artist ids straight out of the seed file (single source of
// truth) rather than duplicating the list. Runs as a build prestep.
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
  ...uniqueIds.map((id) => ({
    loc: `${SITE}/artist/${id}`,
    priority: '0.7',
    changefreq: 'weekly',
  })),
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
