import { useState } from 'react'

interface Props {
  title: string
  text: string
  url: string
}

/** Share via the native share sheet where available (mobile), otherwise copy the link.
 * The shared URL is the artist's canonical page, which is prerendered with per-artist
 * Open Graph tags, so it unfurls with a rich preview on social. */
export function ShareButton({ title, text, url }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked — nothing else we can do gracefully
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? 'Link copied!' : 'Share'}
    </button>
  )
}
