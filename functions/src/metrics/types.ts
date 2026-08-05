export interface MetricFetchResult {
  value: number
  stale: boolean
  /** Overrides the provider's own `id` for this call — used by composite providers
   * (e.g. popularity trying Spotify then falling back to Last.fm) so `metrics.<field>.source`
   * reflects which underlying source actually supplied the value. */
  source?: string
}

export interface MetricProvider {
  /** Stored on `metrics.<field>.source` so it's clear in the data which provider produced a value. */
  id: string
  fetch(artist: { id: string; name: string; spotifyArtistId?: string | null }): Promise<MetricFetchResult>
}
