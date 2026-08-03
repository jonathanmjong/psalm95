import { defineSecret } from 'firebase-functions/params'
import type { MetricProvider } from '../types'

export const spotifyClientId = defineSecret('SPOTIFY_CLIENT_ID')
export const spotifyClientSecret = defineSecret('SPOTIFY_CLIENT_SECRET')

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const clientId = spotifyClientId.value()
  const clientSecret = spotifyClientSecret.value()
  if (!clientId || !clientSecret) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 }
  return cachedToken.value
}

/** Official Spotify Web API `artists.popularity` (0-100). Requires a Spotify Developer
 * app's client credentials, stored as the SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET secrets.
 * Marks stale when credentials aren't configured yet, the artist has no spotifyArtistId,
 * or the API call fails — never throws, so one bad lookup can't fail the whole batch. */
export const spotifyPopularityProvider: MetricProvider = {
  id: 'spotify',
  async fetch(artist) {
    if (!artist.spotifyArtistId) return { value: 0, stale: true }

    const token = await getAccessToken()
    if (!token) return { value: 0, stale: true }

    try {
      const res = await fetch(`https://api.spotify.com/v1/artists/${artist.spotifyArtistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { value: 0, stale: true }
      const json = (await res.json()) as { popularity: number; name: string }
      return { value: json.popularity, stale: false }
    } catch {
      return { value: 0, stale: true }
    }
  },
}
