const API = 'https://commons.wikimedia.org/w/api.php'
const COMPATIBLE_LICENSE = /^(cc0|cc-by|cc by|public domain|pd)/i
const MAX_IMAGES_PER_ARTIST = 15
const MIN_WIDTH = 400
const USER_AGENT = 'psalm95-seed-script/1.0 (https://github.com/jonathanmjong/psalm95)'

interface WikimediaImage {
  url: string
  author: string
  license: string
  sourceUrl: string
}

interface SearchResult {
  query?: { search?: { title: string }[] }
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

function stripHtml(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, '').trim()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** GETs a Wikimedia Commons API URL, retrying once on 429 using the server's Retry-After hint. */
async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 10
      await sleep(retryAfter * 1000)
      continue
    }
    return res
  }
  return null
}

/** Searches Wikimedia Commons for CC/public-domain images of an artist. Best-effort — returns [] on any failure or when no compatible license is found. */
export async function fetchWikimediaImages(artistName: string): Promise<WikimediaImage[]> {
  try {
    const searchUrl = `${API}?action=query&list=search&srsearch=${encodeURIComponent(
      artistName,
    )}&srnamespace=6&srlimit=40&format=json&origin=*`
    const searchRes = await fetchWithRetry(searchUrl)
    if (!searchRes?.ok) return []
    const searchJson = (await searchRes.json()) as SearchResult
    const titles = (searchJson.query?.search ?? []).map((r) => r.title)
    if (titles.length === 0) return []

    await sleep(500)

    const infoUrl = `${API}?action=query&titles=${encodeURIComponent(
      titles.join('|'),
    )}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json&origin=*`
    const infoRes = await fetchWithRetry(infoUrl)
    if (!infoRes?.ok) return []
    const infoJson = (await infoRes.json()) as ImageInfoResult
    const pages = Object.values(infoJson.query?.pages ?? {})

    const images: WikimediaImage[] = []
    for (const page of pages) {
      const info = page.imageinfo?.[0]
      if (!info || info.width < MIN_WIDTH) continue
      const license = stripHtml(info.extmetadata?.LicenseShortName?.value)
      if (!COMPATIBLE_LICENSE.test(license)) continue
      images.push({
        url: info.url,
        author: stripHtml(info.extmetadata?.Artist?.value) || 'Unknown (see source)',
        license,
        sourceUrl: info.descriptionurl,
      })
      if (images.length >= MAX_IMAGES_PER_ARTIST) break
    }
    return images
  } catch {
    return []
  }
}

export async function throttle() {
  await sleep(1200)
}
