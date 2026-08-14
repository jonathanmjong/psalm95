/**
 * Artist photo sourcing via Wikidata/Wikipedia entity resolution.
 *
 * The previous implementation ran a free-text Wikimedia Commons file search on the
 * artist's name. Commons' search is a *text* index, so short/acronym/common-word names
 * matched unrelated files: iKON -> "John_the_Baptist_icon", IVE -> "Institute of
 * Vocational Education", BABYMONSTER -> "Rocket_launcher_BM-21", f(x) -> a maths graph,
 * BTS -> Bratislava Airport. Roughly a third of seeded photos were wrong.
 *
 * This version never searches for pictures by name. It resolves the artist to a single
 * verified Wikidata *entity* first (identity, not text), and only then reads images that
 * the entity itself points at:
 *
 *   1. Candidate entities come from `wbsearchentities` (Wikidata's label/alias index, not
 *      a full-text index), with the Wikipedia article index as a fallback for stylized
 *      names that Wikidata's label search misses (e.g. "CRAVITY").
 *   2. Every candidate must pass a hard identity gate:
 *        - one of its labels/aliases normalizes to the artist's name;
 *        - it is a musical group (P31 -> musical group / ensemble, via a P279* subclass
 *          walk, so girl group / boy band / duo all qualify) or a human (P31 = Q5) whose
 *          occupation (P106 -> P279*) is a musician role.
 *      Survivors are scored on a Spotify id match (P1902), country of origin/citizenship
 *      against the artist's region, MusicBrainz id, genre, label, and group-vs-solo shape,
 *      and must clear MIN_ACCEPT_SCORE. An acronym collision cannot survive: "icon" and
 *      "Institute of the Incarnate Word" are not musical entities, and the Australian band
 *      "Ikon" is a musical entity whose country disqualifies it for a Korean group.
 *   3. Images come ONLY from the resolved entity: P18 (image) and its Commons category
 *      (P373) first, topped up from its linked Wikipedia article when thin. No name search
 *      is ever performed against Commons.
 *   4. Every candidate file is still verified through the Commons `imageinfo` API with the
 *      same CC0/CC-BY/PD license filter, minimum width and attribution capture as before,
 *      plus a MIME check so the video/audio files the old seeder let through are dropped.
 *
 * If resolution fails, the artist gets ZERO photos. A blank gradient avatar is handled
 * gracefully by the UI; a photo of somebody else is not.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'

const COMPATIBLE_LICENSE = /^(cc0|cc-by|cc by|public domain|pd)/i
const MAX_IMAGES_PER_ARTIST = 15
const MIN_WIDTH = 400
const USER_AGENT = 'psalm95-seed-script/2.0 (https://github.com/jonathanmjong/psalm95)'

/** Only real photographs. Excludes SVG logos, audio samples, PDFs and video. */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Non-photo furniture that shows up in article image lists and Commons categories.
 * Matched against titles in which underscores have already been folded to spaces, so
 * every multi-word pattern accepts either separator.
 */
const NON_PHOTO_FILENAME =
  /(logo|wordmark|logotype|icon|favicon|flag[ _]of|coat[ _]of[ _]arms|seal[ _]of|signature|autograph|map[ _]of|locator|commons[ _-]logo|wikimedia|wikipedia|wiki[ _]?letter|disambig|ambox|question[ _]book|edit[ _-]icon|padlock|nuvola|crystal[ _]clear|folder[ _]|emblem|symbol|blank\.|placeholder|spectrogram|waveform|barcode|qr[ _]code|album[ _]cover|single[ _]cover|[ _]cover\.|discography|timeline|font[ _]?awesome|star[ _](full|empty|half)|red[ _]pog|green[ _]pog|text[ _]document|scale[ _]of[ _]justice)/i

// --- Wikidata identity vocabulary ---------------------------------------------------

const P_INSTANCE_OF = 'P31'
const P_SUBCLASS_OF = 'P279'
const P_OCCUPATION = 'P106'
const P_IMAGE = 'P18'
const P_COMMONS_CATEGORY = 'P373'
const P_SPOTIFY_ARTIST_ID = 'P1902'
const P_MUSICBRAINZ_ARTIST_ID = 'P434'
const P_GENRE = 'P136'
/** "has part(s)" — the member entities of a group, used for native-script name tokens. */
const P_HAS_PART = 'P527'
const P_RECORD_LABEL = 'P264'
const P_COUNTRY_OF_ORIGIN = 'P495'
const P_COUNTRY_OF_CITIZENSHIP = 'P27'

const Q_HUMAN = 'Q5'

/**
 * Roots that an acceptable *group* type must reach through P279* (subclass of).
 * Concrete types such as "boy band", "girl group", "musical duo" or "idol group" all
 * reach one of these, so the walk keeps working for types not listed here.
 */
const GROUP_TYPE_ROOTS = new Set([
  'Q215380', // musical group
  'Q2088357', // musical ensemble
  'Q9212979', // musical duo
  'Q281643', // musical trio
])

/** Roots that an acceptable *occupation* must reach through P279* (subclass of). */
const MUSICIAN_OCCUPATION_ROOTS = new Set([
  'Q639669', // musician
  'Q177220', // singer
  'Q488205', // singer-songwriter
  'Q2252262', // rapper
  'Q36834', // composer
  'Q753110', // songwriter
])

/**
 * region -> countries whose artists belong to that region's scene. These are the site's
 * broad K-pop / J-pop / C-pop buckets, not strict nationality: the C-pop bucket covers
 * the whole Mandopop world, so Taiwan, Hong Kong, Singapore and Malaysia count (JJ Lin
 * is Singaporean, Eric Chou is Taiwanese).
 */
const REGION_COUNTRIES: Record<string, string[]> = {
  KR: ['Q884'], // South Korea
  JP: ['Q17'], // Japan
  CN: ['Q148', 'Q865', 'Q8646', 'Q14773', 'Q334', 'Q833'], // China, Taiwan, HK, Macau, Singapore, Malaysia
}

/** region -> the Wikipedia most likely to carry a well-illustrated article. */
const REGION_WIKIS: Record<string, string[]> = {
  KR: ['enwiki', 'kowiki'],
  JP: ['enwiki', 'jawiki'],
  CN: ['enwiki', 'zhwiki'],
}
const WIKI_HOSTS: Record<string, string> = {
  enwiki: 'https://en.wikipedia.org/w/api.php',
  kowiki: 'https://ko.wikipedia.org/w/api.php',
  jawiki: 'https://ja.wikipedia.org/w/api.php',
  zhwiki: 'https://zh.wikipedia.org/w/api.php',
}

// --- Public types -------------------------------------------------------------------

export interface WikimediaImage {
  url: string
  author: string
  license: string
  sourceUrl: string
  /** Commons file title, e.g. `File:Bts_2019.jpg`. Useful for diffing/reporting. */
  title: string
}

/** Minimal artist shape needed to resolve an identity. Matches `ArtistSeed` and the Firestore doc. */
export interface ArtistRef {
  id?: string
  name: string
  region?: string
  type?: string
  spotifyArtistId?: string | null
  /** Used only to accept category/article files that name a member rather than the act. */
  members?: { name: string }[]
}

export interface ResolvedEntity {
  qid: string
  label: string
  description: string
  /** Which wiki article the images were read from, if any. */
  article?: { wiki: string; title: string }
  commonsCategory?: string
  score: number
  reasons: string[]
}

export interface ArtistPhotoResult {
  entity: ResolvedEntity | null
  images: WikimediaImage[]
  /** Human-readable explanation when `entity` is null or `images` is empty. */
  note: string
}

// --- Low-level helpers --------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripHtml(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, '').trim()
}

/** GETs a MediaWiki API URL, retrying on 429 using the server's Retry-After hint. */
async function apiGet<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 5
        await sleep(retryAfter * 1000)
        continue
      }
      if (!res.ok) return null
      return (await res.json()) as T
    } catch {
      await sleep(1000)
    }
  }
  return null
}

/**
 * Normalizes a name for identity comparison: case-folded, accent-stripped, and with all
 * punctuation/whitespace removed, so `f(x)` == `FX`, `H.O.T.` == `H.O.T`, `TVXQ!` == `TVXQ`
 * and `Girls' Generation` == `Girls Generation`.
 */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9぀-ヿ一-鿿가-힯]+/g, '')
}

/**
 * Name variants to accept. Seed names sometimes carry a gloss, e.g.
 * `WJSN (Cosmic Girls)` -> `WJSN (Cosmic Girls)`, `WJSN`, `Cosmic Girls`.
 */
function nameVariants(name: string): string[] {
  const variants = new Set<string>([name])
  const withoutParen = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  if (withoutParen) variants.add(withoutParen)
  for (const inner of name.matchAll(/\(([^)]*)\)/g)) {
    // `f(x)` must not degrade to the variant `x`; only treat parentheses as a gloss when
    // they follow a word boundary (i.e. there is whitespace before the opening bracket).
    if (/\s\($/.test(name.slice(0, (inner.index ?? 0) + 1))) variants.add(inner[1].trim())
  }
  return [...variants].map(normalizeName).filter(Boolean)
}

// --- Wikidata ------------------------------------------------------------------------

interface WdSearchResult {
  search?: { id: string; label?: string; description?: string }[]
}

interface WdSnak {
  mainsnak?: {
    snaktype?: string
    datavalue?: { value: unknown; type: string }
  }
}

interface WdEntity {
  id: string
  labels?: Record<string, { value: string }>
  aliases?: Record<string, { value: string }[]>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, WdSnak[]>
  sitelinks?: Record<string, { title: string }>
}

interface WdEntitiesResult {
  entities?: Record<string, WdEntity>
}

/** Reads the entity-id values of a claim (e.g. all P31 QIDs). */
function claimIds(entity: WdEntity, property: string): string[] {
  const out: string[] = []
  for (const claim of entity.claims?.[property] ?? []) {
    const value = claim.mainsnak?.datavalue?.value as { id?: string } | undefined
    if (value?.id) out.push(value.id)
  }
  return out
}

/** Reads the string values of a claim (e.g. P18 filename, P1902 Spotify id). */
function claimStrings(entity: WdEntity, property: string): string[] {
  const out: string[] = []
  for (const claim of entity.claims?.[property] ?? []) {
    const value = claim.mainsnak?.datavalue?.value
    if (typeof value === 'string') out.push(value)
  }
  return out
}

async function searchEntities(term: string, language: string): Promise<string[]> {
  const url =
    `${WIKIDATA_API}?action=wbsearchentities&format=json&type=item&limit=10` +
    `&language=${language}&uselang=${language}&search=${encodeURIComponent(term)}`
  const json = await apiGet<WdSearchResult>(url)
  return (json?.search ?? []).map((r) => r.id)
}

const entityCache = new Map<string, WdEntity | null>()

async function getEntities(qids: string[]): Promise<Map<string, WdEntity>> {
  const result = new Map<string, WdEntity>()
  const missing: string[] = []
  for (const qid of qids) {
    const cached = entityCache.get(qid)
    if (cached === undefined) missing.push(qid)
    else if (cached) result.set(qid, cached)
  }

  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40)
    const url =
      `${WIKIDATA_API}?action=wbgetentities&format=json&ids=${batch.join('|')}` +
      `&props=labels|aliases|descriptions|claims|sitelinks` +
      `&languages=en|ko|ja|zh&sitefilter=enwiki|kowiki|jawiki|zhwiki|commonswiki`
    const json = await apiGet<WdEntitiesResult>(url)
    for (const qid of batch) {
      const entity = json?.entities?.[qid]
      entityCache.set(qid, entity ?? null)
      if (entity) result.set(qid, entity)
    }
  }
  return result
}

/**
 * True when `start` reaches any of `roots` by walking P279 (subclass of).
 * Depth-limited and cached; a handful of type QIDs cover the whole roster.
 */
const subclassCache = new Map<string, string[]>()
async function reachesRoot(start: string[], roots: Set<string>, maxDepth = 4): Promise<boolean> {
  let frontier = start.filter((q) => !!q)
  const seen = new Set<string>(frontier)
  for (let depth = 0; depth <= maxDepth; depth++) {
    if (frontier.some((q) => roots.has(q))) return true
    if (frontier.length === 0) return false

    const unknown = frontier.filter((q) => !subclassCache.has(q))
    if (unknown.length > 0) {
      const entities = await getEntities(unknown)
      for (const qid of unknown) {
        const entity = entities.get(qid)
        subclassCache.set(qid, entity ? claimIds(entity, P_SUBCLASS_OF) : [])
      }
    }

    const next: string[] = []
    for (const qid of frontier) {
      for (const parent of subclassCache.get(qid) ?? []) {
        if (!seen.has(parent)) {
          seen.add(parent)
          next.push(parent)
        }
      }
    }
    frontier = next
  }
  return false
}

function labelsAndAliases(entity: WdEntity): string[] {
  const out: string[] = []
  for (const label of Object.values(entity.labels ?? {})) out.push(label.value)
  for (const list of Object.values(entity.aliases ?? {})) {
    for (const alias of list) out.push(alias.value)
  }
  return out
}

/**
 * Hard identity gate + score. Returns null when the candidate is not a verified musical
 * entity matching this artist's name — that is what makes the acronym bug impossible.
 */
async function evaluateCandidate(
  entity: WdEntity,
  artist: ArtistRef,
  wantedNames: string[],
): Promise<{ score: number; reasons: string[] } | null> {
  const reasons: string[] = []

  // (1) Name identity: a label or alias must normalize to the artist's name.
  const entityNames = new Set(labelsAndAliases(entity).map(normalizeName))
  if (!wantedNames.some((n) => entityNames.has(n))) return null

  // (2) Type identity: musical group, or a human with a musician occupation.
  const instanceOf = claimIds(entity, P_INSTANCE_OF)
  if (instanceOf.length === 0) return null

  const isHuman = instanceOf.includes(Q_HUMAN)
  let typeOk = false
  if (isHuman) {
    const occupations = claimIds(entity, P_OCCUPATION)
    typeOk = await reachesRoot(occupations, MUSICIAN_OCCUPATION_ROOTS)
    if (typeOk) reasons.push('human with musician occupation (P31=Q5, P106)')
  }
  if (!typeOk) {
    typeOk = await reachesRoot(instanceOf, GROUP_TYPE_ROOTS)
    if (typeOk) reasons.push(`musical group (P31 -> ${instanceOf.join(',')})`)
  }
  if (!typeOk) return null

  // (3) Spotify id. A match pins the entity to the exact catalog artist. A *mismatch* is
  // deliberately not a rejection: the seed's ids are hand-collected and frequently differ
  // from Wikidata's P1902 even for the obviously correct entity.
  const spotifyIds = claimStrings(entity, P_SPOTIFY_ARTIST_ID)
  let score = 10
  if (artist.spotifyArtistId && spotifyIds.includes(artist.spotifyArtistId)) {
    score += 100
    reasons.push(`Spotify id match (P1902=${artist.spotifyArtistId})`)
  } else if (spotifyIds.length > 0) {
    score += 8
    reasons.push('has a Spotify artist id')
  }

  // (4) Country of origin / citizenship. This is the main disambiguator between
  // same-named bands (e.g. the Australian band "Ikon" vs the Korean group "iKON").
  const countries = [...claimIds(entity, P_COUNTRY_OF_ORIGIN), ...claimIds(entity, P_COUNTRY_OF_CITIZENSHIP)]
  const wantedCountries = REGION_COUNTRIES[artist.region ?? ''] ?? []
  if (wantedCountries.length > 0 && countries.some((c) => wantedCountries.includes(c))) {
    score += 50
    reasons.push(`country matches ${artist.region}`)
  } else if (wantedCountries.length > 0 && countries.length > 0) {
    score -= 60
    reasons.push(`country (${countries.join(',')}) is outside ${artist.region}`)
  }

  // (5) Music-database corroboration.
  if (claimStrings(entity, P_MUSICBRAINZ_ARTIST_ID).length > 0) score += 10
  if (claimIds(entity, P_GENRE).length > 0) score += 5
  if (claimIds(entity, P_RECORD_LABEL).length > 0) score += 5

  // (6) Group/solo shape agreement.
  if (artist.type === 'solo') score += isHuman ? 10 : -20
  if (artist.type === 'group') score += isHuman ? -20 : 10

  // (7) Prefer entities that actually have an article / images to read.
  if (entity.sitelinks?.enwiki) score += 5
  if (claimStrings(entity, P_IMAGE).length > 0) score += 5
  if (claimStrings(entity, P_COMMONS_CATEGORY).length > 0) score += 5

  return { score, reasons }
}

interface WikiPagePropsResult {
  query?: {
    pages?: Record<string, { title: string; missing?: string; pageprops?: { wikibase_item?: string } }>
    search?: { title: string }[]
  }
}

/**
 * Fallback candidate discovery: resolve the artist's Wikipedia *article* and read its
 * `wikibase_item`. Needed because `wbsearchentities` misses some all-caps stylizations
 * (e.g. "CRAVITY" returns nothing while the article "Cravity" exists).
 *
 * This uses a text search, but the resulting QIDs still have to clear the same identity
 * gate (name match + musical type + score threshold), so it cannot reintroduce the
 * acronym bug — a page about Bratislava Airport is not a musical entity named "BTS".
 */
async function searchViaWikipedia(host: string, term: string): Promise<string[]> {
  const qids: string[] = []

  // 1. Exact title (following redirects) — precise, no text matching involved.
  const direct = await apiGet<WikiPagePropsResult>(
    `${host}?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item` +
      `&titles=${encodeURIComponent(term)}`,
  )
  for (const page of Object.values(direct?.query?.pages ?? {})) {
    if (page.missing === undefined && page.pageprops?.wikibase_item) qids.push(page.pageprops.wikibase_item)
  }

  // 2. Article-namespace search as a last resort.
  await sleep(150)
  const search = await apiGet<WikiPagePropsResult>(
    `${host}?action=query&format=json&list=search&srnamespace=0&srlimit=5&srsearch=${encodeURIComponent(term)}`,
  )
  const titles = (search?.query?.search ?? []).map((r) => r.title)
  if (titles.length > 0) {
    await sleep(150)
    const props = await apiGet<WikiPagePropsResult>(
      `${host}?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item` +
        `&titles=${encodeURIComponent(titles.join('|'))}`,
    )
    for (const page of Object.values(props?.query?.pages ?? {})) {
      if (page.pageprops?.wikibase_item) qids.push(page.pageprops.wikibase_item)
    }
  }
  return qids
}

/**
 * Minimum score an entity must reach to be accepted. Tuned so that a same-named entity
 * from the wrong country (the Australian band "Ikon" for the Korean group "iKON") falls
 * below it, while a legitimate match with no country claim at all still clears it.
 */
const MIN_ACCEPT_SCORE = 40

/** Resolves an artist to a single verified Wikidata entity, or null. */
export async function resolveArtistEntity(
  artist: ArtistRef,
): Promise<{ entity: ResolvedEntity; wd: WdEntity } | null> {
  const wantedNames = nameVariants(artist.name)
  if (wantedNames.length === 0) return null

  const nativeLanguage = artist.region === 'KR' ? 'ko' : artist.region === 'JP' ? 'ja' : 'zh'
  const languages = ['en', nativeLanguage]
  const searchTerms = [...new Set([artist.name, artist.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()])].filter(
    Boolean,
  )

  const pickBest = async (qids: string[]) => {
    const entities = await getEntities(qids)
    let best: { entity: ResolvedEntity; wd: WdEntity } | null = null
    for (const wd of entities.values()) {
      const verdict = await evaluateCandidate(wd, artist, wantedNames)
      if (!verdict) continue
      if (verdict.score < MIN_ACCEPT_SCORE) continue
      if (best && best.entity.score >= verdict.score) continue
      best = {
        wd,
        entity: {
          qid: wd.id,
          label:
            wd.labels?.en?.value ?? wd.labels?.ko?.value ?? wd.labels?.ja?.value ?? wd.labels?.zh?.value ?? wd.id,
          description: wd.descriptions?.en?.value ?? '',
          commonsCategory: claimStrings(wd, P_COMMONS_CATEGORY)[0],
          score: verdict.score,
          reasons: verdict.reasons,
        },
      }
    }
    return best
  }

  // Pass 1: Wikidata's label/alias index.
  const qids = new Set<string>()
  for (const term of searchTerms) {
    for (const language of languages) {
      for (const qid of await searchEntities(term, language)) qids.add(qid)
      await sleep(120)
    }
  }
  const fromWikidata = qids.size > 0 ? await pickBest([...qids]) : null
  if (fromWikidata) return fromWikidata

  // Pass 2: Wikidata's label search misses some stylized names ("CRAVITY"); go through
  // the Wikipedia article index instead. Candidates still face the same identity gate.
  const wikiHosts = [WIKI_HOSTS.enwiki, WIKI_HOSTS[`${nativeLanguage}wiki`]].filter(Boolean)
  const fallbackQids = new Set<string>()
  for (const term of searchTerms) {
    for (const host of wikiHosts) {
      for (const qid of await searchViaWikipedia(host, term)) {
        if (!qids.has(qid)) fallbackQids.add(qid)
      }
      await sleep(150)
    }
  }
  if (fallbackQids.size === 0) return null
  return pickBest([...fallbackQids])
}

// --- Image collection (from the verified entity only) --------------------------------

interface WikiImagesResult {
  query?: { pages?: Record<string, { images?: { title: string }[] }> }
}

interface CategoryMembersResult {
  query?: { categorymembers?: { title: string; ns: number }[] }
}

interface ImageInfoResult {
  query?: {
    pages?: Record<
      string,
      {
        title: string
        imageinfo?: {
          url: string
          width: number
          mime?: string
          descriptionurl: string
          extmetadata?: {
            LicenseShortName?: { value: string }
            Artist?: { value: string }
          }
        }[]
      }
    >
  }
}

/** Images used in the resolved Wikipedia article (identity-scoped, not a text search). */
async function articleImages(wiki: string, title: string): Promise<string[]> {
  const host = WIKI_HOSTS[wiki]
  if (!host) return []
  const url = `${host}?action=query&format=json&prop=images&imlimit=100&titles=${encodeURIComponent(title)}`
  const json = await apiGet<WikiImagesResult>(url)
  const pages = Object.values(json?.query?.pages ?? {})
  return pages.flatMap((page) => (page.images ?? []).map((image) => image.title))
}

/**
 * Files under the Commons category linked from the resolved entity (P373).
 *
 * Breadth-first over subcategories, because some artist categories are pure containers:
 * `Category:H.O.T.` holds only `Category:Members of H.O.T.`, whose own members are the
 * per-member categories that actually hold the photos. The walk stops as soon as enough
 * files have been found, so well-populated categories never pay for the extra requests,
 * and the whole traversal stays inside the entity's own category tree.
 */
const CATEGORY_MAX_DEPTH = 2
const CATEGORY_MAX_REQUESTS = 14

async function commonsCategoryFiles(category: string): Promise<string[]> {
  const files: string[] = []
  const enough = MAX_IMAGES_PER_ARTIST * 3
  let requests = 0
  const visited = new Set<string>([category])

  const fetchMembers = async (title: string) => {
    requests++
    const url =
      `${COMMONS_API}?action=query&format=json&list=categorymembers&cmlimit=100` +
      `&cmtitle=${encodeURIComponent(`Category:${title}`)}`
    const json = await apiGet<CategoryMembersResult>(url)
    return json?.query?.categorymembers ?? []
  }

  let frontier = [category]
  for (let depth = 0; depth <= CATEGORY_MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const title of frontier) {
      if (files.length >= enough || requests >= CATEGORY_MAX_REQUESTS) return files
      for (const member of await fetchMembers(title)) {
        if (member.ns === 6) files.push(member.title)
        else if (member.ns === 14) {
          const sub = member.title.replace(/^Category:/, '')
          if (!visited.has(sub)) {
            visited.add(sub)
            next.push(sub)
          }
        }
      }
      await sleep(150)
    }
    // Only descend when this level did not yield enough photos on its own.
    if (files.length >= enough) break
    frontier = next
  }
  return files
}

/**
 * Verifies candidate Commons files: license, width, MIME and attribution.
 * Preserves the original CC0/CC-BY/PD filter, MIN_WIDTH rule and attribution capture.
 */
async function verifyCommonsFiles(titles: string[]): Promise<Map<string, WikimediaImage>> {
  const verified = new Map<string, WikimediaImage>()
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40)
    const url =
      `${COMMONS_API}?action=query&format=json&prop=imageinfo&iiprop=url|mime|extmetadata` +
      `&iiurlwidth=1200&titles=${encodeURIComponent(batch.join('|'))}`
    const json = await apiGet<ImageInfoResult>(url)
    for (const page of Object.values(json?.query?.pages ?? {})) {
      const info = page.imageinfo?.[0]
      if (!info) continue
      if (info.mime && !ALLOWED_MIME.has(info.mime)) continue
      if (info.width < MIN_WIDTH) continue
      const license = stripHtml(info.extmetadata?.LicenseShortName?.value)
      if (!COMPATIBLE_LICENSE.test(license)) continue
      verified.set(page.title, {
        // Commons appends utm_* tracking params to imageinfo URLs; store the bare file URL.
        url: info.url.split('?')[0],
        author: stripHtml(info.extmetadata?.Artist?.value) || 'Unknown (see source)',
        license,
        sourceUrl: info.descriptionurl,
        title: page.title,
      })
    }
    await sleep(200)
  }
  return verified
}

/** Verifies a candidate file list against Commons and returns the survivors, in order. */
async function collect(titles: string[]): Promise<WikimediaImage[]> {
  if (titles.length === 0) return []
  const verified = await verifyCommonsFiles(titles.slice(0, 120))
  const out: WikimediaImage[] = []
  for (const title of titles) {
    const image = verified.get(title)
    if (image) out.push(image)
  }
  return out
}

/**
 * Resolves an artist and returns only photos that belong to the resolved entity.
 * Returns `entity: null` and `images: []` when identity cannot be verified.
 */
export async function fetchArtistPhotos(artist: ArtistRef): Promise<ArtistPhotoResult> {
  let resolved: Awaited<ReturnType<typeof resolveArtistEntity>> = null
  try {
    resolved = await resolveArtistEntity(artist)
  } catch {
    return { entity: null, images: [], note: 'entity resolution threw' }
  }
  if (!resolved) {
    return { entity: null, images: [], note: 'no Wikidata entity passed the identity gate' }
  }

  const { entity, wd } = resolved

  // De-duplicates, normalizes to `File:...` and drops non-raster formats plus obvious
  // non-photo furniture (logos, icons, maps, chart images) before any network call.
  const seen = new Set<string>()
  const clean = (raw: string[]): string[] => {
    const out: string[] = []
    for (const item of raw) {
      const key = (item.startsWith('File:') ? item : `File:${item}`).replace(/_/g, ' ')
      if (seen.has(key)) continue
      seen.add(key)
      if (/\.(svg|ogg|ogv|oga|wav|mp3|webm|pdf|djvu|gif|tif|tiff|xcf)$/i.test(key)) continue
      if (NON_PHOTO_FILENAME.test(key)) continue
      out.push(key)
    }
    return out
  }

  /**
   * Does a filename actually name this act? Categories (and to a lesser extent articles)
   * carry collateral — a station named after the group, a politician at an event they
   * played, an exhibition a member attended. Matching against the entity's labels and
   * aliases in *every* language is what makes this work for non-Latin filenames, where the
   * act is written 빅스 / 乃木坂46 / 우주소녀 rather than in Latin script.
   */
  // Member labels come from Wikidata rather than our roster: idol photos are very often
  // filed under one member's name in the local script (刘宇, 우주소녀), which a romanized
  // roster name can never match.
  const memberLabels: string[] = []
  try {
    const memberQids = claimIds(wd, P_HAS_PART).slice(0, 30)
    if (memberQids.length > 0) {
      for (const member of (await getEntities(memberQids)).values()) {
        memberLabels.push(...labelsAndAliases(member))
      }
    }
  } catch {
    /* best effort — the act's own labels still gate the files */
  }

  const nameTokens = [
    ...labelsAndAliases(wd),
    ...memberLabels,
    ...(artist.members ?? []).map((m) => m.name),
    artist.name,
  ]
    .map((t) => normalizeName(t))
    .filter((t) => t.length >= 2)
  const mentionsArtist = (file: string): boolean => {
    const normalized = normalizeName(decodeURIComponent(file))
    return nameTokens.some((t) => normalized.includes(t))
  }

  // Stage 1 — the entity's own image (P18) and its Commons category (P373). P18 is curated
  // *about this entity* and is taken as-is; the category is a container others can file
  // loosely-related media into, so those have to name the act.
  const primary: string[] = clean(claimStrings(wd, P_IMAGE))
  if (entity.commonsCategory) {
    try {
      primary.push(...clean(await commonsCategoryFiles(entity.commonsCategory)).filter(mentionsArtist))
    } catch {
      /* best effort */
    }
  }

  let images = (await collect(primary)).slice(0, MAX_IMAGES_PER_ARTIST)

  // Stage 2 — images used in the entity's Wikipedia article. Looser (an article can
  // illustrate a *related* act), so it is only used to top up a thin result.
  if (images.length < 5) {
    const wikis = REGION_WIKIS[artist.region ?? ''] ?? ['enwiki']
    const fromArticles: string[] = []
    for (const wiki of wikis) {
      const title = wd.sitelinks?.[wiki]?.title
      if (!title) continue
      entity.article ??= { wiki, title }
      try {
        fromArticles.push(...clean(await articleImages(wiki, title)).filter(mentionsArtist))
      } catch {
        /* best effort */
      }
      await sleep(200)
    }
    images = [...images, ...(await collect(fromArticles))].slice(0, MAX_IMAGES_PER_ARTIST)
  } else {
    for (const wiki of REGION_WIKIS[artist.region ?? ''] ?? ['enwiki']) {
      const title = wd.sitelinks?.[wiki]?.title
      if (title) {
        entity.article ??= { wiki, title }
        break
      }
    }
  }

  if (images.length === 0 && seen.size === 0) {
    return { entity, images: [], note: `resolved ${entity.qid} but it links no candidate photo files` }
  }

  return {
    entity,
    images,
    note:
      images.length > 0
        ? `resolved ${entity.qid} (${entity.label})`
        : `resolved ${entity.qid} but no linked file passed the license/size checks`,
  }
}

/**
 * Backwards-compatible entry point used by the seed script.
 * Accepts the artist record (not just a name) so identity can be verified; a bare string
 * still works but resolves with weaker signals.
 */
export async function fetchWikimediaImages(artist: ArtistRef | string): Promise<WikimediaImage[]> {
  const ref: ArtistRef = typeof artist === 'string' ? { name: artist } : artist
  const result = await fetchArtistPhotos(ref)
  return result.images
}

export async function throttle() {
  await sleep(1200)
}
