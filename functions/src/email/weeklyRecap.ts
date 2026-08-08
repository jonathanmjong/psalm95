import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore } from 'firebase-admin/firestore'

export const resendApiKey = defineSecret('RESEND_API_KEY')

const FROM = 'PsalmTune <recap@psalmtune.com>'

interface TopArtist {
  name: string
  weeklyVotes: number
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

function recapHtml(displayName: string, streak: number, top: TopArtist[]): string {
  const rows = top
    .map((a, i) => `<li>${i + 1}. <strong>${a.name}</strong> — ${a.weeklyVotes.toLocaleString()} votes</li>`)
    .join('')
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:22px">Your PsalmTune week 💜</h1>
      <p>Hey ${displayName || 'there'},</p>
      <p>${streak > 0 ? `You're on a <strong>${streak}-day voting streak</strong> — don't let it slip!` : 'Start a voting streak this week 🔥'}</p>
      <h2 style="font-size:16px">This week's top of the board</h2>
      <ol style="padding-left:18px">${rows}</ol>
      <p><a href="https://psalmtune.com/" style="display:inline-block;background:#c026d3;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Go vote</a></p>
      <p style="color:#888;font-size:12px">You're getting this because you turned on weekly recaps. Manage it at
        <a href="https://psalmtune.com/profile">psalmtune.com/profile</a>.</p>
    </div>`
}

/** Weekly recap to opted-in users. Inert (logs and returns) until RESEND_API_KEY is set —
 * requires a Resend account with the psalmtune.com sending domain verified. */
export const weeklyRecapEmail = onSchedule(
  { schedule: '0 18 * * 0', timeZone: 'UTC', secrets: [resendApiKey] }, // Sundays 18:00 UTC
  async () => {
    const apiKey = resendApiKey.value()
    if (!apiKey || apiKey === 'unset-placeholder') {
      console.log('weeklyRecapEmail: RESEND_API_KEY not configured — skipping send.')
      return
    }

    const db = getFirestore()
    const topSnap = await db.collection('artists').orderBy('weeklyVotes', 'desc').limit(5).get()
    const top: TopArtist[] = topSnap.docs.map((d) => ({
      name: d.data().name,
      weeklyVotes: d.data().weeklyVotes ?? 0,
    }))

    const optedIn = await db.collection('users').where('emailOptIn', '==', true).get()
    let sent = 0
    for (const doc of optedIn.docs) {
      const u = doc.data()
      if (!u.email) continue
      const ok = await sendEmail(
        apiKey,
        u.email,
        'Your PsalmTune week 💜',
        recapHtml(u.displayName ?? '', u.currentStreak ?? 0, top),
      )
      if (ok) sent++
    }
    console.log(`weeklyRecapEmail: sent ${sent}/${optedIn.size} recaps.`)
  },
)
