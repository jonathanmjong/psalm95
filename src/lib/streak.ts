import { showToast } from './toast'
import type { StreakResult } from './callables'

/** Only milestones a real user can reach today — nothing aspirational-but-impossible. */
const MILESTONES: Record<number, string> = {
  3: '🔥 3-day streak! You’re on fire.',
  7: '⚡ 7 days straight — Weekly Warrior unlocked.',
  14: '💫 Two full weeks. Nobody’s voting harder.',
  30: '💎 30 days. Unbreakable.',
}

/** Celebrates whatever just happened to the streak: a rescued streak and/or a milestone.
 * Called after a vote or a daily-heart claim; silent when the day was already earned. */
export function celebrateStreak(result: StreakResult): void {
  if (!result.streakAdvanced) return
  if (result.freezeUsed) {
    showToast(`❄️ A streak freeze saved your ${result.currentStreak}-day streak!`)
  }
  const milestone = MILESTONES[result.currentStreak]
  if (milestone) showToast(milestone)
}
