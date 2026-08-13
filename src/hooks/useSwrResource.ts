import { useEffect, useState } from 'react'
import type { SwrResource } from '../lib/swr'

/**
 * Binds a module-level {@link SwrResource} to React.
 *
 * Seeds state from whatever the resource has already delivered this session (so a
 * re-mount paints synchronously, with no await at all), then re-renders on the cached
 * delivery and again on the fresh one. Both deliveries take the identical state path,
 * so the second is a no-op re-render when the data hasn't changed.
 *
 * `empty` is the value used before the first delivery — pass a module-level constant so
 * the effect doesn't re-run on every render.
 */
export function useSwrResource<T>(resource: SwrResource<T>, empty: T) {
  const [data, setData] = useState<T>(() => resource.peek() ?? empty)
  const [loading, setLoading] = useState(() => resource.peek() === undefined)

  useEffect(() => {
    let active = true
    const deliver = (value: T) => {
      if (!active) return
      setData(value)
      setLoading(false)
    }
    const unsubscribe = resource.subscribe(deliver)
    const already = resource.peek()
    if (already !== undefined) deliver(already)
    resource.load().then(deliver, () => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [resource, empty])

  return { data, loading }
}
