import { useEffect, useRef } from 'react'

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

interface Props {
  /** The ad unit slot id from AdSense (data-ad-slot). */
  slot: string
  className?: string
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/** A Google AdSense ad unit. Renders nothing until VITE_ADSENSE_CLIENT is configured
 * (i.e. after the AdSense account is approved and its publisher id is set), so the UI
 * stays ad-free and un-cluttered during development / before approval. */
export function AdSlot({ slot, className }: Props) {
  const ref = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!ADSENSE_CLIENT) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // AdSense not loaded yet / blocked — fail silently, no ad shown.
    }
  }, [])

  if (!ADSENSE_CLIENT) return null

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
