import type { MetricProvider } from '../types'

const USER_AGENT = 'psalm95-metrics/1.0 (https://github.com/jonathanmjong/psalm95)'

interface MBArtistSearch {
  artists?: { id: string; name: string; score: number }[]
}
interface MBReleaseGroups {
  'release-groups'?: { id: string }[]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** No free API reports actual album *sales* figures (that data is locked behind paid
 * providers like Luminate/Chartmetric — getting real sales here remains a future todo).
 * This uses MusicBrainz's free, open, no-signup catalog instead: the artist's count of
 * official studio albums, as a discography-size activity signal. It is honestly NOT sales
 * data, which is why the UI calls this "Discography" rather than "Albums sold" — same
 * underlying pipeline slot, different (real, if less directly relevant) meaning. */
export const musicbrainzDiscographyProvider: MetricProvider = {
  id: 'musicbrainz-release-count',
  async fetch(artist) {
    try {
      const searchRes = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(artist.name)}&fmt=json&limit=10`,
        { headers: { 'User-Agent': USER_AGENT } },
      )
      if (!searchRes.ok) return { value: 0, stale: true }
      const searchJson = (await searchRes.json()) as MBArtistSearch
      const exactMatches = (searchJson.artists ?? []).filter(
        (a) => a.name.toLowerCase() === artist.name.toLowerCase(),
      )
      if (exactMatches.length === 0) return { value: 0, stale: true }
      const best = exactMatches.reduce((a, b) => (b.score > a.score ? b : a))

      await sleep(1100) // MusicBrainz asks for ~1 request/sec from unauthenticated clients

      const releasesRes = await fetch(
        `https://musicbrainz.org/ws/2/release-group?artist=${best.id}&type=album&fmt=json&limit=100`,
        { headers: { 'User-Agent': USER_AGENT } },
      )
      if (!releasesRes.ok) return { value: 0, stale: true }
      const releasesJson = (await releasesRes.json()) as MBReleaseGroups
      const count = releasesJson['release-groups']?.length ?? 0
      if (count <= 0) return { value: 0, stale: true }
      return { value: count, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
