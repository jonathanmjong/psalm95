import type { UserProfile } from '../hooks/useUserProfile'
import { currentWeekId } from './dates'

export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
  earned: (p: UserProfile) => boolean
}

function votesThisWeek(p: UserProfile): number {
  return (p.weeklyArtistVotes[currentWeekId()] ?? []).length
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-vote', emoji: '🗳️', title: 'First Vote', description: 'Cast your first vote', earned: (p) => p.totalVotes >= 1 },
  { id: 'full-ballot', emoji: '✅', title: 'Full Ballot', description: 'Use all 3 votes in a week', earned: (p) => votesThisWeek(p) >= 3 },
  { id: 'on-fire', emoji: '🔥', title: 'On Fire', description: '3-day voting streak', earned: (p) => p.longestStreak >= 3 },
  { id: 'weekly-warrior', emoji: '⚡', title: 'Weekly Warrior', description: '7-day voting streak', earned: (p) => p.longestStreak >= 7 },
  { id: 'unbreakable', emoji: '💎', title: 'Unbreakable', description: '30-day voting streak', earned: (p) => p.longestStreak >= 30 },
  { id: 'half-century', emoji: '🎯', title: 'Half Century', description: 'Cast 50 votes', earned: (p) => p.totalVotes >= 50 },
  { id: 'century', emoji: '🏆', title: 'Century', description: 'Cast 100 votes', earned: (p) => p.totalVotes >= 100 },
  { id: 'photographer', emoji: '📸', title: 'Photographer', description: 'Upload a picture', earned: (p) => p.activeUploadCount >= 1 },
]

export function earnedCount(p: UserProfile): number {
  return ACHIEVEMENTS.filter((a) => a.earned(p)).length
}
