import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { currentDayIdKST } from '../dates'
import {
  MAX_SENDS_PER_RUN,
  emailLayout,
  escapeHtml,
  resendApiKey,
  resendKeyOrNull,
  sendEmail,
  sendPacingMs,
  sleep,
  wantsEmail,
} from './send'

/** A streak shorter than this isn't worth interrupting someone's inbox over. */
const MIN_STREAK = 3

function streakHtml(displayName: string, streak: number, freezes: number): string {
  const name = escapeHtml(displayName || 'there')
  const freezeLine =
    freezes > 0
      ? `<p>You do have <strong>${freezes} streak ${freezes === 1 ? 'freeze' : 'freezes'}</strong> banked — if today slips past you, a freeze will cover it this once. But freezes are hard to earn (one every 30 days), so it's worth spending ten seconds instead.</p>`
      : `<p>You have no streak freezes banked, so there's no safety net tonight.</p>`

  return emailLayout({
    heading: `🔥 Your ${streak}-day streak ends at midnight KST`,
    bodyHtml: `
      <p>Hey ${name},</p>
      <p>You haven't claimed today's Daily Heart yet, and the day rolls over at <strong>midnight KST</strong> — about five hours from now.</p>
      ${freezeLine}
      <p style="color:#666;font-size:14px">Casting one of your weekly artist votes counts for the streak too — either one keeps the ${streak} alive.</p>`,
    ctaLabel: 'Claim your Daily Heart',
    ctaUrl: 'https://psalmtune.com/',
  })
}

/**
 * Daily at 10:00 UTC = 19:00 KST — roughly five hours before the midnight-KST day boundary
 * that ends the streak, late enough that anyone who was going to act today already has.
 *
 * Inert (logs and returns) until RESEND_API_KEY is set — that requires a Resend account with
 * the psalmtune.com sending domain verified.
 */
export const streakRiskEmail = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'UTC', secrets: [resendApiKey], timeoutSeconds: 540 },
  async () => {
    const apiKey = resendKeyOrNull()
    if (!apiKey) {
      console.log('streakRiskEmail: RESEND_API_KEY not configured — skipping send.')
      return
    }

    const db = getFirestore()
    const todayKst = currentDayIdKST()

    // Streak length is the only server-indexable part of the audience; the remaining
    // conditions (acted today, has an address, hasn't opted out) are checked per doc.
    const candidates = await db.collection('users').where('currentStreak', '>=', MIN_STREAK).get()

    let sent = 0
    let failed = 0
    let capped = false
    for (const doc of candidates.docs) {
      if (sent >= MAX_SENDS_PER_RUN) {
        capped = true
        break
      }
      try {
        const u = doc.data()
        const email = (u.email as string | undefined)?.trim()
        if (!email) continue
        if (u.lastVoteDate === todayKst) continue // already acted today — streak is safe
        if (!wantsEmail(u, 'streakReminders')) continue

        const streak = (u.currentStreak as number | undefined) ?? 0
        const freezes = (u.streakFreezes as number | undefined) ?? 0
        const ok = await sendEmail(
          apiKey,
          'PsalmTune Streaks',
          email,
          `🔥 Your ${streak}-day streak ends at midnight KST`,
          streakHtml((u.displayName as string | undefined) ?? '', streak, freezes),
        )
        if (ok) sent++
        else failed++
        await sleep(sendPacingMs)
      } catch (err) {
        failed++
        console.error(`streakRiskEmail: failed for user ${doc.id}:`, err)
      }
    }

    if (capped) {
      console.warn(
        `streakRiskEmail: hit the ${MAX_SENDS_PER_RUN}-send cap — ${candidates.size} candidates were scanned and the remainder got no reminder today.`,
      )
    }
    console.log(
      `streakRiskEmail: sent ${sent} reminders (${failed} failed) from ${candidates.size} candidates with a ${MIN_STREAK}+ day streak.`,
    )
  },
)
