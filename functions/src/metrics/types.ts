export interface MetricFetchResult {
  value: number
  stale: boolean
}

export interface MetricProvider {
  /** Stored on `metrics.<field>.source` so it's clear in the data which provider produced a value. */
  id: string
  fetch(artist: { id: string; name: string; spotifyArtistId?: string | null }): Promise<MetricFetchResult>
}
