import { kstDayIdBefore } from './dates'

/** A user can bank at most this many streak freezes. Freezes are only ever earned, never sold. */
export const STREAK_FREEZE_CAP = 2
/** One freeze is granted each time the streak crosses a multiple of this many days. */
export const FREEZE_EARN_EVERY = 30

/** Fields to merge into users/{uid} after an action that counts toward the streak.
 * `lastVoteDate` keeps its historical name but now holds a KST day id. */
export interface StreakFields {
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  lastVoteDate: string
}

export interface StreakAdvance {
  fields: StreakFields
  /** True when a banked freeze covered exactly one missed day instead of the streak resetting. */
  freezeUsed: boolean
  /** False when the user already acted earlier today — the fields are unchanged. */
  advanced: boolean
}

/**
 * Shared daily-streak advance, used by both `castArtistVote` and `claimDailyHeart` — either
 * deliberate act earns the day. Day boundary is midnight KST.
 *
 * - acted today already → no change
 * - acted yesterday → +1
 * - acted exactly 2 days ago and a freeze is banked → spend one freeze and still +1
 * - anything else (3+ day gap, or never) → reset to 1
 *
 * Landing on a multiple of 30 days banks a freeze, up to `STREAK_FREEZE_CAP`.
 */
export function advanceStreak(
  userData: FirebaseFirestore.DocumentData,
  todayKst: string,
): StreakAdvance {
  const lastVoteDate = userData.lastVoteDate as string | undefined
  const currentStreak = (userData.currentStreak as number | undefined) ?? 0
  const longestStreak = (userData.longestStreak as number | undefined) ?? 0
  const streakFreezes = Math.min((userData.streakFreezes as number | undefined) ?? 0, STREAK_FREEZE_CAP)

  if (lastVoteDate === todayKst) {
    return {
      fields: { currentStreak, longestStreak, streakFreezes, lastVoteDate: todayKst },
      freezeUsed: false,
      advanced: false,
    }
  }

  const yesterday = kstDayIdBefore(todayKst, 1)
  const twoDaysAgo = kstDayIdBefore(todayKst, 2)

  let nextStreak: number
  let nextFreezes = streakFreezes
  let freezeUsed = false
  if (lastVoteDate === yesterday) {
    nextStreak = currentStreak + 1
  } else if (lastVoteDate === twoDaysAgo && streakFreezes > 0) {
    // Exactly one day missed and a freeze in the bank — the streak survives.
    nextStreak = currentStreak + 1
    nextFreezes = streakFreezes - 1
    freezeUsed = true
  } else {
    nextStreak = 1
  }

  if (nextStreak % FREEZE_EARN_EVERY === 0) {
    nextFreezes = Math.min(nextFreezes + 1, STREAK_FREEZE_CAP)
  }

  return {
    fields: {
      currentStreak: nextStreak,
      longestStreak: Math.max(longestStreak, nextStreak),
      streakFreezes: nextFreezes,
      lastVoteDate: todayKst,
    },
    freezeUsed,
    advanced: true,
  }
}
