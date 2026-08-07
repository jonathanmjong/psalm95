// Post-build prerender: generates a static HTML file per artist route (dist/artist/<id>.html)
// from the built dist/index.html template, with that artist's real title, description,
// canonical, Open Graph/Twitter tags, JSON-LD structured data, and a <noscript> content
// block. This gives crawlers and social scrapers correct per-page metadata + indexable
// content WITHOUT executing JavaScript. Derives everything from the static seed roster —
// no headless browser or Firestore access needed, so it's fast and deterministic.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SITE = 'https://psalmtune.com'
const dist = resolve(here, '../dist')
const template = readFileSync(resolve(dist, 'index.html'), 'utf8')
const artistsSrc = readFileSync(resolve(here, '../functions/src/seed/artists.ts'), 'utf8')

const REGION_LABEL = { KR: 'K-pop', CN: 'C-pop', JP: 'J-pop' }

const htmlEscape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- Parse the seed roster (each artist is a single object literal line) ---
function parseArtists(src) {
  const artists = []
  for (const line of src.split('\n')) {
    if (!/^\s*\{\s*id:\s*'/.test(line)) continue
    const id = line.match(/\bid:\s*'([^']+)'/)?.[1]
    const name = line.match(/\bname:\s*(['"])((?:\\.|(?!\1).)*)\1/)?.[2]
    const region = line.match(/\bregion:\s*'(KR|CN|JP)'/)?.[1]
    const type = line.match(/\btype:\s*'(group|solo)'/)?.[1]
    if (!id || !name || !region || !type) continue
    const membersSeg = line.match(/members:\s*\[([\s\S]*)\]/)?.[1] ?? ''
    const members = [...membersSeg.matchAll(/m\(\s*'[^']*'\s*,\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g)].map(
      (m) => m[2],
    )
    artists.push({ id, name, region, type, members })
  }
  return artists
}

function structuredData(a, url, region) {
  if (a.type === 'group') {
    return {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: a.name,
      genre: region,
      url,
      ...(a.members.length
        ? { member: a.members.map((m) => ({ '@type': 'Person', name: m })) }
        : {}),
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: a.name,
    jobTitle: `${region} artist`,
    url,
  }
}

function renderArtist(a) {
  const region = REGION_LABEL[a.region]
  const url = `${SITE}/artist/${a.id}`
  const title = `${a.name} — ${region} profile, ranking & pictures | PsalmTune`
  const memberList =
    a.type === 'group' && a.members.length ? ` Explore member profiles (${a.members.join(', ')}).` : ''
  const description = `Vote for ${a.name} and follow their popularity, discography and concerts on PsalmTune — the fan-driven ${region} ranking platform.${memberList}`

  let html = template

  // Head meta swaps (tolerant of the template's multi-line tag formatting).
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEscape(title)}</title>`)
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${htmlEscape(description)}" />`,
  )
  html = html.replace(
    /<link rel="canonical" href="[\s\S]*?"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
  )
  html = html.replace(
    /<meta property="og:type" content="[\s\S]*?"\s*\/>/,
    `<meta property="og:type" content="profile" />`,
  )
  html = html.replace(
    /<meta property="og:title" content="[\s\S]*?"\s*\/>/,
    `<meta property="og:title" content="${htmlEscape(title)}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${htmlEscape(description)}" />`,
  )
  html = html.replace(
    /<meta property="og:url" content="[\s\S]*?"\s*\/>/,
    `<meta property="og:url" content="${url}" />`,
  )
  html = html.replace(
    /<meta name="twitter:title" content="[\s\S]*?"\s*\/>/,
    `<meta name="twitter:title" content="${htmlEscape(title)}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${htmlEscape(description)}" />`,
  )
  // Swap the site-level WebSite JSON-LD for artist-level structured data.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${JSON.stringify(structuredData(a, url, region), null, 2)}\n</script>`,
  )

  // Indexable content for non-JS crawlers; invisible to real (JS) users.
  const noscript = `<noscript>
      <h1>${htmlEscape(a.name)} — ${region}</h1>
      ${a.type === 'group' && a.members.length ? `<p>Members: ${htmlEscape(a.members.join(', '))}</p>` : ''}
      <p>${htmlEscape(description)}</p>
      <p><a href="/">Back to all PsalmTune rankings</a></p>
    </noscript>`
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`)

  return html
}

const artists = parseArtists(artistsSrc)
mkdirSync(resolve(dist, 'artist'), { recursive: true })
let written = 0
for (const a of artists) {
  writeFileSync(resolve(dist, 'artist', `${a.id}.html`), renderArtist(a))
  written++
}
console.log(`Prerendered ${written} artist pages (of ${artists.length} parsed).`)
