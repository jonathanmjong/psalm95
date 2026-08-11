/** ISO week id, e.g. "2026-W32". Computed server-side so clients can't manipulate their vote window. */
export function currentWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function currentMonthId(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function currentYearId(date = new Date()): string {
  return String(date.getUTCFullYear())
}

/** UTC day id, e.g. "2026-08-08" — used for the daily ranking snapshots. */
export function currentDayId(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

const KST_OFFSET_MS = 9 * 3_600_000

/** KST (UTC+9) day id, e.g. "2026-08-08". The fixed day boundary for the daily heart and
 * the daily streak — midnight KST, the reset the core audience already lives by. The
 * weekly/monthly/yearly windows above stay on UTC. */
export function currentDayIdKST(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The KST day id `days` days before `dayId` (both "YYYY-MM-DD"). */
export function kstDayIdBefore(dayId: string, days: number): string {
  return new Date(Date.parse(`${dayId}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
}
