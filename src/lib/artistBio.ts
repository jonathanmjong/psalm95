/**
 * Turns the structured facts already on an artist doc (agency, debut date, fandom, member
 * positions/interests) into a short prose paragraph, instead of only the fact-chip/definition-
 * list treatment the page already gives them. Those facts differ per artist and per member, so
 * the paragraph is genuinely unique from page to page — this exists because 107 pages that only
 * differed by swapped nouns in a data table read as thin, machine-generated content to anyone
 * (or anything) judging whether the site is worth showing ads on.
 *
 * Deterministic on purpose: the same artist always renders the same paragraph, so the
 * server-rendered noscript shell and the client-hydrated page never disagree, and a search
 * engine never sees the wording change between crawls.
 */
import type { Artist, Member, Region } from '../types'
import { formatBirthdate } from './zodiac'

const REGION_LABEL: Record<Region, string> = { KR: 'K-pop', CN: 'C-pop', JP: 'J-pop' }

/** Deterministic per-artist choice among a few phrasings, so pages read as differently
 *  worded rather than the same sentence with only the nouns swapped. */
function pick<T>(options: readonly T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return options[h % options.length]
}

function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** "Lineup includes A (Leader), B, C and D" — members with a known role lead the list. */
function membersClause(members: Member[]): string | null {
  if (members.length < 2) return null
  const withRole = members.filter((m) => m.position)
  const withoutRole = members.filter((m) => !m.position)
  const parts = [
    ...withRole.map((m) => `${m.name} (${m.position})`),
    ...withoutRole.map((m) => m.name),
  ]
  return joinNatural(parts)
}

function factScore(m: Member): number {
  return (
    (m.interests?.length ? 1 : 0) +
    (m.favoriteFoods?.length ? 1 : 0) +
    (m.favoriteAnimal ? 1 : 0) +
    (m.position ? 1 : 0)
  )
}

/** The member with the most filled-in facts — the one worth spending a sentence on. */
function spotlightMember(members: Member[]): Member | undefined {
  return [...members].sort((a, b) => factScore(b) - factScore(a))[0]
}

function firstRole(position: string | undefined): string | null {
  return position ? position.split(',')[0].trim().toLowerCase() : null
}

function spotlightSentence(artist: Artist, member: Member): string | null {
  const bits: string[] = []
  if (member.interests && member.interests.length > 0) {
    bits.push(`enjoys ${joinNatural(member.interests.slice(0, 3))}`)
  }
  if (member.favoriteFoods && member.favoriteFoods.length > 0) {
    const plural = member.favoriteFoods.length > 1
    bits.push(`${plural ? 'favorite foods include' : 'a favorite food is'} ${joinNatural(member.favoriteFoods)}`)
  }
  if (member.favoriteAnimal) bits.push(`is known for loving ${member.favoriteAnimal}s`)
  if (bits.length === 0) return null

  if (artist.type === 'solo') return `${artist.name} ${bits.join(', and ')}.`
  const role = firstRole(member.position)
  const subject = role ? `${member.name}, the group's ${role},` : member.name
  return `${subject} ${bits.join(', and ')}.`
}

/** A 2-4 sentence prose paragraph summarizing what's known about the artist, for the "About"
 *  section on the artist page and the prerendered noscript shell. */
export function artistBioParagraph(artist: Artist): string {
  const region = REGION_LABEL[artist.region]
  const kind = artist.type === 'group' ? 'group' : 'solo artist'
  const sentences: string[] = []

  const debutPhrasing = [
    (d: string) => `debuted on ${formatBirthdate(d)}`,
    (d: string) => `made its debut on ${formatBirthdate(d)}`,
  ] as const
  const agencyClause = artist.agency ? ` under ${artist.agency}` : ''
  if (artist.debutDate) {
    sentences.push(
      `${artist.name} is a ${region} ${kind} that ${pick(debutPhrasing, artist.id)(artist.debutDate)}${agencyClause}.`,
    )
  } else if (artist.agency) {
    sentences.push(`${artist.name} is a ${region} ${kind} signed to ${artist.agency}.`)
  } else {
    sentences.push(`${artist.name} is a ${region} ${kind} on PsalmTune's fan-voted ranking board.`)
  }

  if (artist.type === 'group') {
    const clause = membersClause(artist.members)
    if (clause) sentences.push(`The lineup is made up of ${clause}.`)
  }

  if (artist.fandomName) {
    sentences.push(
      `Fans go by the name ${artist.fandomName}${
        artist.fandomColorName ? `, with ${artist.fandomColorName.toLowerCase()} as the official fan color` : ''
      }.`,
    )
  }

  const spotlight = artist.type === 'group' ? spotlightMember(artist.members) : artist.members[0]
  if (spotlight) {
    const extra = spotlightSentence(artist, spotlight)
    if (extra) sentences.push(extra)
  }

  if (artist.influences && artist.influences.length > 0) {
    const plural = artist.influences.length > 1
    sentences.push(`${artist.name} has cited ${joinNatural(artist.influences)} as ${plural ? 'influences' : 'an influence'}.`)
  }

  return sentences.join(' ')
}
