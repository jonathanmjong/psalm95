import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { currentWeekId } from '../dates'
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

const WEEKLY_VOTE_LIMIT = 3

interface FandomStanding {
  /** 1-based position on the /fandoms weekly board. */
  rank: number
  /** Votes needed to pass the fandom directly above. 0 when already #1. */
  gapToNext: number
  fandomName: string
  artistName: string
}

/**
 * The /fandoms weekly standing, computed exactly the way the page does it: artists that have
 * a fandom, ordered by raw `weeklyVotes` descending, gap measured against the row above.
 */
async function loadStandings(db: FirebaseFirestore.Firestore): Promise<Map<string, FandomStanding>> {
  const snap = await db.collection('artists').get()
  const ranked = snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((a) => Boolean(a.data.fandomName))
    .map((a) => ({
      id: a.id,
      artistName: (a.data.name as string | undefined) ?? '',
      fandomName: (a.data.fandomName as string | undefined) ?? '',
      votes: (a.data.weeklyVotes as number | undefined) ?? 0,
    }))
    .sort((x, y) => y.votes - x.votes)

  return new Map(
    ranked.map((a, i) => [
      a.id,
      {
        rank: i + 1,
        gapToNext: i > 0 ? ranked[i - 1].votes - a.votes : 0,
        fandomName: a.fandomName,
        artistName: a.artistName,
      },
    ]),
  )
}

function resetHtml(displayName: string, votesLeft: number, standing: FandomStanding | null): string {
  const name = escapeHtml(displayName || 'there')
  const plural = votesLeft === 1 ? 'vote' : 'votes'

  let standingHtml = ''
  if (standing) {
    const fandom = escapeHtml(standing.fandomName || standing.artistName)
    const gap =
      standing.rank === 1
        ? `holding <strong>#1</strong> this week`
        : standing.gapToNext > 0
          ? `sitting at <strong>#${standing.rank}</strong>, ${standing.gapToNext.toLocaleString()} ${standing.gapToNext === 1 ? 'vote' : 'votes'} behind #${standing.rank - 1}`
          : `sitting at <strong>#${standing.rank}</strong>, level with #${standing.rank - 1}`
    standingHtml = `<p>${fandom} is ${gap} on the weekly board.</p>`
  }

  return emailLayout({
    heading: `⏰ ${votesLeft} ${plural} left before the weekly reset`,
    bodyHtml: `
      <p>Hey ${name},</p>
      <p>You still have <strong>${votesLeft} unspent ${plural}</strong> this week. Everything resets at <strong>00:00 UTC Monday</strong> — a few hours from now — and unspent votes don't roll over.</p>
      ${standingHtml}`,
    ctaLabel: 'Spend your votes',
    ctaUrl: 'https://psalmtune.com/fandoms',
  })
}

/**
 * Sundays 18:00 UTC — six hours before `resetWeeklyVotes` wipes the board at Monday 00:00 UTC.
 *
 * Inert (logs and returns) until RESEND_API_KEY is set — that requires a Resend account with
 * the psalmtune.com sending domain verified.
 */
export const weeklyResetEmail = onSchedule(
  { schedule: '0 18 * * 0', timeZone: 'UTC', secrets: [resendApiKey], timeoutSeconds: 540 },
  async () => {
    const apiKey = resendKeyOrNull()
    if (!apiKey) {
      console.log('weeklyResetEmail: RESEND_API_KEY not configured — skipping send.')
      return
    }

    const db = getFirestore()
    const weekId = currentWeekId()
    const standings = await loadStandings(db)

    // "Votes left" lives inside a map keyed by week id, which Firestore can't range-query,
    // so the whole user collection is scanned and filtered in memory.
    const users = await db.collection('users').get()

    let sent = 0
    let failed = 0
    let capped = false
    for (const doc of users.docs) {
      if (sent >= MAX_SENDS_PER_RUN) {
        capped = true
        break
      }
      try {
        const u = doc.data()
        const email = (u.email as string | undefined)?.trim()
        if (!email) continue
        if (!wantsEmail(u, 'weeklyReset')) continue

        const weeklyArtistVotes = (u.weeklyArtistVotes ?? {}) as Record<string, string[]>
        const used = (weeklyArtistVotes[weekId] ?? []).length
        const votesLeft = WEEKLY_VOTE_LIMIT - used
        if (votesLeft <= 0) continue

        const biasArtistId = (u.biasArtistId as string | undefined) || null
        const standing = biasArtistId ? (standings.get(biasArtistId) ?? null) : null

        const ok = await sendEmail(
          apiKey,
          'PsalmTune Reminders',
          email,
          `⏰ ${votesLeft} ${votesLeft === 1 ? 'vote' : 'votes'} left — weekly reset in hours`,
          resetHtml((u.displayName as string | undefined) ?? '', votesLeft, standing),
        )
        if (ok) sent++
        else failed++
        await sleep(sendPacingMs)
      } catch (err) {
        failed++
        console.error(`weeklyResetEmail: failed for user ${doc.id}:`, err)
      }
    }

    if (capped) {
      console.warn(
        `weeklyResetEmail: hit the ${MAX_SENDS_PER_RUN}-send cap — ${users.size} users were scanned and the remainder got no reminder this week.`,
      )
    }
    console.log(
      `weeklyResetEmail: sent ${sent} reminders (${failed} failed) across ${users.size} users for week ${weekId}.`,
    )
  },
)
