/** ISO week id, e.g. "2026-W32" — mirrors the Cloud Functions implementation so the
 * client can read this week's cast votes out of users/{uid}.weeklyArtistVotes. */
/** Milliseconds until the weekly vote reset (Monday 00:00 UTC), matching the reset job. */
export function msUntilWeeklyReset(now = new Date()): number {
  const d = new Date(now)
  const day = d.getUTCDay() // 0=Sun..6=Sat; reset is Monday (1)
  const daysUntilMon = (8 - (day === 0 ? 7 : day)) % 7 || 7
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMon))
  return next.getTime() - now.getTime()
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m'
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function currentWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
