// Post-build prerender: generates static HTML shells for the routes that get shared —
// one per artist (dist/artist/<id>.html) plus dist/fandoms.html and dist/hall-of-fame.html —
// from the built dist/index.html template, each with its own title, description, canonical,
// Open Graph/Twitter tags, JSON-LD structured data and a <noscript> content block. Crawlers
// and social scrapers therefore get correct per-page metadata + indexable content WITHOUT
// executing JavaScript. (Firebase Hosting serves these because `cleanUrls: true` maps
// /artist/bts -> /artist/bts.html and /fandoms -> /fandoms.html before the SPA rewrite runs.)
//
// The roster comes from the static seed file, so this is deterministic and offline-capable.
// On top of that it *tries* to fetch the public artistIndex Firestore doc (rebuilt hourly)
// to enrich each page with a live rank and a real photo for og:image. If that fetch fails
// for any reason the build still succeeds with seed-only metadata and the site default card.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SITE = 'https://psalmtune.com'
const DEFAULT_OG = `${SITE}/og.png`
const ARTIST_INDEX_URL =
  'https://firestore.googleapis.com/v1/projects/jj-psalm95/databases/(default)/documents/config/artistIndex'
const FETCH_TIMEOUT_MS = 15_000

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

// --- Live roster index (best effort) ---

/** Firestore REST "typed value" -> plain JS. */
function decodeValue(v) {
  if (!v || typeof v !== 'object') return undefined
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {})
  return undefined
}

function decodeFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v)
  return out
}

/** Resolves to a Map<artistId, liveEntry>, or null if the index is unavailable. */
async function fetchArtistIndex() {
  try {
    const res = await fetch(ARTIST_INDEX_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const doc = await res.json()
    const artists = decodeValue(doc?.fields?.artists)
    if (!Array.isArray(artists) || artists.length === 0) throw new Error('no artists in index')
    const map = new Map()
    for (const a of artists) if (a?.id) map.set(a.id, a)
    return map
  } catch (err) {
    console.warn(
      `[prerender] artistIndex unavailable (${err?.message ?? err}) — falling back to seed-only metadata.`,
    )
    return null
  }
}

// --- Head rewriting helpers ---------------------------------------------------------
// The template's tags are formatted across multiple lines by Prettier, so every pattern
// is tolerant of newlines between attributes.

function setTag(html, kind, key, content) {
  const attr = kind === 'property' ? 'property' : 'name'
  const pattern = new RegExp(`<meta\\s+${attr}="${key}"[\\s\\S]*?/>`)
  const tag = `<meta ${attr}="${key}" content="${htmlEscape(content)}" />`
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function dropTag(html, kind, key) {
  const attr = kind === 'property' ? 'property' : 'name'
  return html.replace(new RegExp(`\\s*<meta\\s+${attr}="${key}"[\\s\\S]*?/>`), '')
}

function setCanonical(html, url) {
  return html.replace(/<link rel="canonical" href="[\s\S]*?"\s*\/>/, `<link rel="canonical" href="${url}" />`)
}

function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${htmlEscape(title)}</title>`)
}

/** Replaces the site-level WebSite JSON-LD (the first ld+json block). The Organization
 *  block that follows it is left intact on every page. */
function setStructuredData(html, data) {
  return html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`,
  )
}

function setNoscript(html, body) {
  return html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript>\n${body}\n    </noscript>`)
}

/** Applies the shared head block every prerendered route needs. `image` may be a real
 *  photo (large card) or omitted, in which case the site default og.png is used and the
 *  Twitter card falls back to the small `summary` form. */
function applyMeta(html, { title, description, url, ogType, image, imageAlt, card }) {
  const large = Boolean(image)
  const imageUrl = image ?? DEFAULT_OG
  let out = html
  out = setTitle(out, title)
  out = setTag(out, 'name', 'description', description)
  out = setCanonical(out, url)
  out = setTag(out, 'property', 'og:type', ogType)
  out = setTag(out, 'property', 'og:title', title)
  out = setTag(out, 'property', 'og:description', description)
  out = setTag(out, 'property', 'og:url', url)
  out = setTag(out, 'property', 'og:image', imageUrl)
  out = setTag(out, 'property', 'og:image:alt', imageAlt ?? title)
  if (large) {
    // A real photo has unknown dimensions and isn't necessarily a PNG — keeping the
    // template's 1200x630 / image-png hints would lie to scrapers, so drop them for
    // photo cards only.
    out = dropTag(out, 'property', 'og:image:width')
    out = dropTag(out, 'property', 'og:image:height')
    out = dropTag(out, 'property', 'og:image:type')
  }
  out = setTag(out, 'name', 'twitter:card', card ?? (large ? 'summary_large_image' : 'summary'))
  out = setTag(out, 'name', 'twitter:title', title)
  out = setTag(out, 'name', 'twitter:description', description)
  out = setTag(out, 'name', 'twitter:image', imageUrl)
  out = setTag(out, 'name', 'twitter:image:alt', imageAlt ?? title)
  return out
}

// --- Artist pages -------------------------------------------------------------------

function structuredData(a, url, region, live) {
  const image = live?.picture ? [live.picture] : undefined
  if (a.type === 'group') {
    return {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: a.name,
      genre: region,
      url,
      ...(image ? { image } : {}),
      ...(a.members.length ? { member: a.members.map((m) => ({ '@type': 'Person', name: m })) } : {}),
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: a.name,
    jobTitle: `${region} artist`,
    url,
    ...(image ? { image } : {}),
  }
}

/** Home › <region> › <artist>. The region crumb points at the home board (which is where
 *  a region filter lands); it carries a ?region= hint so the crumb has a distinct item
 *  URL, and home's own canonical keeps it from being indexed separately. */
function breadcrumb(a, url, region) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'PsalmTune', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: region, item: `${SITE}/?region=${a.region}` },
      { '@type': 'ListItem', position: 3, name: a.name, item: url },
    ],
  }
}

function renderArtist(a, live, total) {
  const region = REGION_LABEL[a.region]
  const url = `${SITE}/artist/${a.id}`
  const ranked = live?.rank && total ? `#${live.rank} of ${total}` : null

  const title = ranked
    ? `${a.name} — ${ranked} · ${region} ranking, profile & pictures | PsalmTune`
    : `${a.name} — ${region} profile, ranking & pictures | PsalmTune`

  const memberList =
    a.type === 'group' && a.members.length ? ` Explore member profiles (${a.members.join(', ')}).` : ''
  const fandom = live?.fandomName ? ` Fandom: ${live.fandomName}.` : ''
  const description = ranked
    ? `${a.name} is ranked ${ranked} on PsalmTune. Vote for them and follow their popularity and fan-vote ranking on the fan-driven ${region} ranking platform.${fandom}${memberList}`
    : `Vote for ${a.name} and follow their popularity and fan-vote ranking on PsalmTune — the fan-driven ${region} ranking platform.${memberList}`

  let html = applyMeta(template, {
    title,
    description,
    url,
    ogType: 'profile',
    image: live?.picture,
    imageAlt: live?.picture ? `${a.name} — ${region} artist on PsalmTune` : undefined,
  })

  html = setStructuredData(html, [
    structuredData(a, url, region, live),
    breadcrumb(a, url, region),
  ])

  html = setNoscript(
    html,
    `      <h1>${htmlEscape(a.name)} — ${region}${ranked ? ` (${ranked})` : ''}</h1>
      ${a.type === 'group' && a.members.length ? `<p>Members: ${htmlEscape(a.members.join(', '))}</p>` : ''}
      <p>${htmlEscape(description)}</p>
      <p><a href="/">Back to all PsalmTune rankings</a></p>`,
  )

  return html
}

// --- Shared SPA routes (fandom race / hall of fame) ----------------------------------

const SHELLS = [
  {
    file: 'fandoms.html',
    path: '/fandoms',
    title: 'Live fandom race — who rules this week? | PsalmTune',
    heading: 'Live fandom race',
    description:
      'Watch the fandom leaderboard move in real time: which fanbase is voting hardest this week, month and year across K-pop, C-pop and J-pop. Join your fandom and out-vote the rest before the weekly reset.',
    noscript:
      '<p>The PsalmTune fandom race ranks every fandom by the votes its fans cast this week, month and year. Winners are crowned at the weekly reset.</p>',
  },
  {
    file: 'hall-of-fame.html',
    path: '/hall-of-fame',
    title: 'Weekly champions — every crowned fandom | PsalmTune',
    heading: 'Fandom Hall of Fame',
    description:
      'Every weekly champion fandom on PsalmTune, week by week — reigning streaks, past winners and the K-pop, C-pop and J-pop artists their fans voted to the top.',
    noscript:
      '<p>The PsalmTune Hall of Fame records every fandom that has won a weekly race, along with their win streaks.</p>',
  },
  {
    file: 'about.html',
    path: '/about',
    title: 'About PsalmTune — how the ranking works, and who made it',
    heading: 'About PsalmTune',
    description:
      'PsalmTune is an independent, fan-made ranking site for K-pop, C-pop and J-pop. How the score is calculated, where the photos come from, and who is behind it.',
    noscript:
      '<p>PsalmTune is a fan-made ranking site with no affiliation to any label, agency or artist. Scores combine online popularity with weekly and monthly fan votes, weighted equally. Artist photos are freely-licensed Wikimedia Commons images, credited to their authors.</p>',
  },
]

function renderShell(shell) {
  const url = SITE + shell.path
  let html = applyMeta(template, {
    title: shell.title,
    description: shell.description,
    url,
    ogType: 'website',
    imageAlt: 'PsalmTune — the people’s ranking for K-pop, C-pop and J-pop',
    // No route-specific photo, but the site default card is a wide 1200x630 image.
    card: 'summary_large_image',
  })

  html = setStructuredData(html, [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: shell.heading,
      url,
      description: shell.description,
      isPartOf: { '@type': 'WebSite', name: 'PsalmTune', url: `${SITE}/` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PsalmTune', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: shell.heading, item: url },
      ],
    },
  ])

  html = setNoscript(
    html,
    `      <h1>${htmlEscape(shell.heading)}</h1>
      ${shell.noscript}
      <p><a href="/">Back to all PsalmTune rankings</a></p>`,
  )

  return html
}

// --- Run ------------------------------------------------------------------------------

const index = await fetchArtistIndex()
const artists = parseArtists(artistsSrc)
const total = index?.size ?? 0

mkdirSync(resolve(dist, 'artist'), { recursive: true })
let withPhoto = 0
for (const a of artists) {
  const entry = index?.get(a.id)
  const picture = entry?.topPictureUrls?.find((u) => typeof u === 'string' && /^https?:\/\//.test(u))
  if (picture) withPhoto++
  const live = entry ? { ...entry, picture } : null
  writeFileSync(resolve(dist, 'artist', `${a.id}.html`), renderArtist(a, live, total))
}

for (const shell of SHELLS) writeFileSync(resolve(dist, shell.file), renderShell(shell))

console.log(
  `Prerendered ${artists.length} artist pages (${withPhoto} with a real og:image, ` +
    `live index ${index ? `hit: ${total} ranked artists` : 'unavailable'}) ` +
    `+ ${SHELLS.length} route shells (${SHELLS.map((s) => s.path).join(', ')}).`,
)
