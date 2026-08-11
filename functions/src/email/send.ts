import { defineSecret } from 'firebase-functions/params'

/** Resend API key. Until this is set the email jobs are inert: they log and return, never throw.
 * Set with: firebase functions:secrets:set RESEND_API_KEY */
export const resendApiKey = defineSecret('RESEND_API_KEY')

/** All transactional mail goes out from the one verified address; the display name varies by
 * email type so the inbox shows what the message is about. */
const FROM_ADDRESS = 'hello@psalmtune.com'

/** Hard cap on sends per scheduled run. Hitting it is logged as a warning — a cap that
 * silently drops recipients is worse than no cap. */
export const MAX_SENDS_PER_RUN = 500

/** Resend's free tier allows ~2 requests/second. Pace sequential sends just under that so a
 * large batch degrades into "slower" rather than "silently 429'd". */
const SEND_INTERVAL_MS = 550

export type EmailPrefKey = 'streakReminders' | 'weeklyReset'

/**
 * Per-type email opt-out. Absent map or absent key means opted **in** — existing users who
 * predate `emailPrefs` still get these, and only an explicit `false` suppresses a send.
 */
export function wantsEmail(userData: FirebaseFirestore.DocumentData, key: EmailPrefKey): boolean {
  const prefs = userData.emailPrefs as Record<string, unknown> | undefined
  return prefs?.[key] !== false
}

/** The secret's value, or null when it isn't configured — callers log and return on null. */
export function resendKeyOrNull(): string | null {
  let key: string
  try {
    key = resendApiKey.value()
  } catch {
    return null
  }
  if (!key || key === 'unset-placeholder') return null
  return key
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const sendPacingMs = SEND_INTERVAL_MS

/** POSTs one email to Resend. Returns false (never throws) so one bad address can't kill a batch. */
export async function sendEmail(
  apiKey: string,
  fromName: string,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${FROM_ADDRESS}>`, to, subject, html }),
    })
    if (!res.ok) {
      console.error(`Resend rejected a send (${res.status}): ${await res.text().catch(() => '')}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Resend request failed:', err)
    return false
  }
}

/** Shared shell: heading, body, one call-to-action button, and the opt-out footer every
 * email must carry. */
export function emailLayout(opts: {
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
}): string {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
      <h1 style="font-size:22px;margin:0 0 12px">${opts.heading}</h1>
      ${opts.bodyHtml}
      <p style="margin:22px 0">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:#c026d3;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(opts.ctaLabel)}</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px">
        <a href="https://psalmtune.com/profile" style="color:#888">Manage email notifications in your profile</a>
      </p>
    </div>`
}
