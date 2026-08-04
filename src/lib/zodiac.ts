const SIGNS: { name: string; endMonth: number; endDay: number }[] = [
  { name: 'Capricorn', endMonth: 1, endDay: 19 },
  { name: 'Aquarius', endMonth: 2, endDay: 18 },
  { name: 'Pisces', endMonth: 3, endDay: 20 },
  { name: 'Aries', endMonth: 4, endDay: 19 },
  { name: 'Taurus', endMonth: 5, endDay: 20 },
  { name: 'Gemini', endMonth: 6, endDay: 20 },
  { name: 'Cancer', endMonth: 7, endDay: 22 },
  { name: 'Leo', endMonth: 8, endDay: 22 },
  { name: 'Virgo', endMonth: 9, endDay: 22 },
  { name: 'Libra', endMonth: 10, endDay: 22 },
  { name: 'Scorpio', endMonth: 11, endDay: 21 },
  { name: 'Sagittarius', endMonth: 12, endDay: 21 },
  { name: 'Capricorn', endMonth: 12, endDay: 31 },
]

/** Falls back to computing the sign from a birthdate when zodiacSign wasn't set explicitly. */
export function zodiacFromDate(dateStr: string): string | null {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const month = d.getMonth() + 1
  const day = d.getDate()
  return SIGNS.find((s) => month < s.endMonth || (month === s.endMonth && day <= s.endDay))?.name ?? null
}

export function formatBirthdate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
