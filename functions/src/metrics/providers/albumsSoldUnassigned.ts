import type { MetricProvider } from '../types'

/** No free, ToS-compliant, structured source for current-year album sales exists for this
 * artist set (Billboard/Oricon/Circle Chart don't offer public APIs and scraping their
 * chart pages is both fragile and against their terms). This provider is an honest
 * placeholder: it always reports stale so the ranking job never pretends to have real
 * data. Swap in a real provider here — same `MetricProvider` shape, no pipeline changes —
 * if/when a licensed data source (e.g. a paid chart-data API) is wired up. */
export const albumsSoldUnassignedProvider: MetricProvider = {
  id: 'unassigned',
  async fetch() {
    return { value: 0, stale: true }
  },
}
