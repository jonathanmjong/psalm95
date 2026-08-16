import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

/** Streak fields every streak-advancing callable reports back (see functions/src/streak.ts). */
export interface StreakResult {
  currentStreak: number
  streakFreezes: number
  freezeUsed: boolean
  streakAdvanced: boolean
}

export const castArtistVote = httpsCallable<
  { artistId?: string; warm?: boolean },
  { weeklyVotesRemaining: number } & StreakResult
>(functions, 'castArtistVote')

/** Hearting a picture is idempotent: a repeat heart resolves with `alreadyVoted: true` and the
 * unchanged count instead of throwing, so callers can just render the filled state. Real
 * failures (daily cap, missing picture, signed out) still reject with an HttpsError. */
export const votePicture = httpsCallable<
  { pictureId: string; artistId: string },
  { voteCount: number; alreadyVoted: boolean }
>(functions, 'votePicture')

interface TaggedMember {
  artistId: string
  memberId: string
}

export const createPictureDoc = httpsCallable<
  { artistId: string; storagePath: string; taggedMembers?: TaggedMember[]; credit?: string },
  { pictureId: string }
>(functions, 'createPictureDoc')

export const deletePicture = httpsCallable<{ artistId: string; pictureId: string }, { ok: boolean }>(
  functions,
  'deletePicture',
)

export const voteBattle = httpsCallable<
  { choiceArtistId: string },
  { aVotes: number; bVotes: number; choice: string }
>(functions, 'voteBattle')

export const claimReferral = httpsCallable<{ refUid: string }, { ok: boolean }>(functions, 'claimReferral')

export const createCheckoutSession = httpsCallable<
  { amount: number; origin: string },
  { url: string | null }
>(functions, 'createCheckoutSession')

export const joinFandom = httpsCallable<{ artistId: string | null }, { ok: boolean; biasArtistId: string | null }>(
  functions,
  'joinFandom',
)

export const claimHandle = httpsCallable<{ handle: string }, { handle: string }>(
  functions,
  'claimHandle',
)

export const claimDailyHeart = httpsCallable<
  void,
  { longestStreak: number; weeklyHearts: number } & StreakResult
>(functions, 'claimDailyHeart')

export const recordVisit = httpsCallable<
  { source?: string; landing?: string },
  { ok: boolean }
>(functions, 'recordVisit')
