import type { UserProfile } from '../hooks/useUserProfile'
import { currentWeekId } from './dates'

/**
 * The slice of a user an achievement can be judged from. `UserProfile` satisfies it, and so
 * does the public `profiles/{uid}` projection — which deliberately omits the weekly ballot,
 * so anything reading it must be marked `requiresBallot`.
 */
export interface AchievementStats {
  totalVotes: number
  longestStreak: number
  activeUploadCount: number
  weeklyArtistVotes?: Record<string, string[]>
}

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
  /** Needs the private weekly ballot — never evaluated on a public profile. */
  requiresBallot?: boolean
  earned: (p: AchievementStats) => boolean
}

function votesThisWeek(p: AchievementStats): number {
  return (p.weeklyArtistVotes?.[currentWeekId()] ?? []).length
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-vote', emoji: '🗳️', title: 'First Vote', description: 'Cast your first vote', earned: (p) => p.totalVotes >= 1 },
  { id: 'full-ballot', emoji: '✅', title: 'Full Ballot', description: 'Use all 3 votes in a week', requiresBallot: true, earned: (p) => votesThisWeek(p) >= 3 },
  { id: 'on-fire', emoji: '🔥', title: 'On Fire', description: '3-day streak', earned: (p) => p.longestStreak >= 3 },
  { id: 'weekly-warrior', emoji: '⚡', title: 'Weekly Warrior', description: '7-day streak', earned: (p) => p.longestStreak >= 7 },
  { id: 'unbreakable', emoji: '💎', title: 'Unbreakable', description: '30-day streak', earned: (p) => p.longestStreak >= 30 },
  { id: 'half-century', emoji: '🎯', title: 'Half Century', description: 'Cast 50 votes', earned: (p) => p.totalVotes >= 50 },
  { id: 'century', emoji: '🏆', title: 'Century', description: 'Cast 100 votes', earned: (p) => p.totalVotes >= 100 },
  { id: 'photographer', emoji: '📸', title: 'Photographer', description: 'Upload a picture', earned: (p) => p.activeUploadCount >= 1 },
]

/** Achievements a public profile can honestly judge from the projection alone. */
export const PUBLIC_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => !a.requiresBallot)

export function earnedCount(p: UserProfile): number {
  return ACHIEVEMENTS.filter((a) => a.earned(p)).length
}
