/** The artist-doc fields a metric provider is allowed to read. */
export interface MetricArtist {
  id: string
  name: string
  /** 'KR' | 'JP' | 'CN' — used to pick the regional Wikipedia and to gate entity identity. */
  region?: string
  /** 'group' | 'solo' — a shape signal for Wikidata entity resolution. */
  type?: string
  spotifyArtistId?: string | null
  /** Cached Wikipedia article titles by language code, written by the pageviews provider. */
  wikiArticles?: Record<string, string> | null
}

export interface MetricFetchResult {
  value: number
  stale: boolean
  /** Overrides the provider's own `id` for this call — used by composite providers
   * (e.g. popularity trying Wikipedia then falling back to Deezer) so `metrics.<field>.source`
   * reflects which underlying source actually supplied the value. */
  source?: string
  /** Top-level artist-doc fields the provider wants persisted alongside the metric, so an
   * expensive lookup only has to happen once (the pageviews provider caches the Wikipedia
   * article titles it resolved). Written by `runMetrics`; providers never touch Firestore
   * themselves, which keeps them runnable from read-only verification scripts. */
  patch?: Record<string, unknown>
}

export interface MetricProvider {
  /** Stored on `metrics.<field>.source` so it's clear in the data which provider produced a value. */
  id: string
  fetch(artist: MetricArtist): Promise<MetricFetchResult>
}
