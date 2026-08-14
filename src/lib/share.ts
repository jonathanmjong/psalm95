/** The one place that knows how to get a message out of the app: the native share sheet
 * where it exists (mobile), otherwise the clipboard. Kept framework-free so non-React
 * callers (the toast bus, for instance) can share too. */
export interface SharePayload {
  title: string
  text: string
  url: string
  /** What lands on the clipboard when there is no share sheet. Defaults to the bare URL —
   * rally/brag moments pass the full message so the boast survives a desktop paste. */
  copyText?: string
}

export type ShareOutcome = 'shared' | 'copied' | 'failed'

export async function shareOrCopy({ title, text, url, copyText }: SharePayload): Promise<ShareOutcome> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch {
      // user cancelled or share failed — fall through to copy
    }
  }
  try {
    await navigator.clipboard.writeText(copyText ?? url)
    return 'copied'
  } catch {
    // clipboard blocked — nothing else we can do gracefully
    return 'failed'
  }
}
