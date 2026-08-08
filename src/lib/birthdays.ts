import type { Artist, Member } from '../types'

export interface BirthdayStatus {
  daysUntil: number
  isToday: boolean
  turningAge: number
}

/** Days until a member's next birthday (0 = today), plus the age they'll turn.
 * Computed in UTC to match how birthdates are stored. Returns null for bad dates. */
export function birthdayStatus(birthdate: string, now = new Date()): BirthdayStatus | null {
  const d = new Date(`${birthdate}T00:00:00Z`)
  if (isNaN(d.getTime())) return null
  const bm = d.getUTCMonth()
  const bd = d.getUTCDate()
  const by = d.getUTCFullYear()

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  let next = new Date(Date.UTC(today.getUTCFullYear(), bm, bd))
  if (next.getTime() < today.getTime()) next = new Date(Date.UTC(today.getUTCFullYear() + 1, bm, bd))

  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000)
  return { daysUntil, isToday: daysUntil === 0, turningAge: next.getUTCFullYear() - by }
}

export interface UpcomingBirthday {
  artistId: string
  artistName: string
  member: Member
  status: BirthdayStatus
}

/** Members across all artists with a birthday within `withinDays`, soonest first. */
export function upcomingBirthdays(artists: Artist[], withinDays = 7, now = new Date()): UpcomingBirthday[] {
  const out: UpcomingBirthday[] = []
  for (const artist of artists) {
    for (const member of artist.members) {
      if (!member.birthdate) continue
      const status = birthdayStatus(member.birthdate, now)
      if (status && status.daysUntil <= withinDays) {
        out.push({ artistId: artist.id, artistName: artist.name, member, status })
      }
    }
  }
  return out.sort((a, b) => a.status.daysUntil - b.status.daysUntil)
}

export function birthdayLabel(status: BirthdayStatus): string {
  if (status.isToday) return `🎂 Birthday today — turning ${status.turningAge}!`
  if (status.daysUntil === 1) return `🎂 Birthday tomorrow (turning ${status.turningAge})`
  return `🎂 Birthday in ${status.daysUntil} days (turning ${status.turningAge})`
}
