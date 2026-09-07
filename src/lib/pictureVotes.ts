/**
 * The per-artist picture-vote allowance, shared by every surface that can heart a photo.
 *
 * The limit is enforced server-side in functions/src/pictureVotes.ts; this module exists so
 * the grid, the lightbox and the artist page all state the same rule in the same words and
 * derive "how many are left" the same way. The spend map lives on the user doc
 * (`pictureVotesByArtist`), which the app already subscribes to via `useUserProfile`, so the
 * remaining count costs no extra read.
 */
import type { UserProfile } from '../hooks/useUserProfile'
import { plural } from './plural'

/** Mirrors PICTURE_VOTES_PER_ARTIST in functions/src/pictureVotes.ts. */
export const PICTURE_VOTES_PER_ARTIST = 3

/**
 * Picture votes this user has left for `artistId`. Signed out counts as a full allowance:
 * the heart's job then is to trigger sign-in, not to look spent.
 */
export function picturesVotesLeft(profile: UserProfile | null, artistId: string): number {
  if (!profile) return PICTURE_VOTES_PER_ARTIST
  const spent = profile.pictureVotesByArtist[artistId] ?? 0
  return Math.max(0, PICTURE_VOTES_PER_ARTIST - spent)
}

/** One-line rule statement for a gallery header. Visible copy, never hover-only. */
export function pictureVotesRuleText(artistName: string, votesLeft: number, signedIn: boolean): string {
  const rule = `You get ${PICTURE_VOTES_PER_ARTIST} votes to pick ${artistName}'s best pictures. The most-voted picture becomes their main photo.`
  if (!signedIn) return `${rule} Sign in to vote.`
  return votesLeft > 0
    ? `${rule} You have ${plural(votesLeft, 'vote')} left for ${artistName}.`
    : `${rule} You've used all ${PICTURE_VOTES_PER_ARTIST} for ${artistName} — every other artist still has theirs.`
}

/** Why a heart is spent, phrased for the inline error slot next to the button. */
export function pictureVotesSpentText(artistName: string): string {
  return `You've used all ${PICTURE_VOTES_PER_ARTIST} of your picture votes for ${artistName}. They don't reset — but every other artist still has ${PICTURE_VOTES_PER_ARTIST} waiting.`
}
