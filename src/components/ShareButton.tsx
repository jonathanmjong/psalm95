import { useState } from 'react'
import { shareOrCopy } from '../lib/share'

interface Props {
  title: string
  text: string
  url: string
  /** `button` is the standalone pill (page headers, cards); `inline` is a compact,
   * borderless variant that sits next to running text — e.g. the post-vote receipt. */
  variant?: 'button' | 'inline'
  /** Overrides the resting label ("Share"). The copied state always takes over briefly. */
  label?: string
  /** Put the whole rally message on the clipboard when there is no native share sheet,
   * instead of just the link. For brag moments the words are the point. */
  copyMessage?: boolean
}

/** Share via the native share sheet where available (mobile), otherwise copy the link.
 * The shared URL is a canonical page prerendered with per-page Open Graph tags, so it
 * unfurls with a rich preview on social. */
export function ShareButton({ title, text, url, variant = 'button', label = 'Share', copyMessage }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const outcome = await shareOrCopy({
      title,
      text,
      url,
      copyText: copyMessage ? `${text} ${url}` : url,
    })
    if (outcome !== 'copied') return
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={
        variant === 'inline'
          ? 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]'
          : 'inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]'
      }
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
      {copied ? (copyMessage ? 'Copied!' : 'Link copied!') : label}
    </button>
  )
}
