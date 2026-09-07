import { showToast } from './toast'
import { shareOrCopy } from './share'
import type { StreakResult } from './callables'

/** Only milestones a real user can reach today — nothing aspirational-but-impossible. */
const MILESTONES: Record<number, string> = {
  3: '🔥 3-day streak! You’re on fire.',
  7: '⚡ 7 days straight — Weekly Warrior unlocked.',
  14: '💫 Two full weeks. Nobody’s voting harder.',
  30: '💎 30 days. Unbreakable.',
}

interface CelebrateOptions {
  /** The user's claimed public handle, when they have one: the brag then points at their
   * own profile page instead of the homepage. */
  handle?: string
}

/** The brag a milestone is worth sharing with — accurate to the streak just reached. */
function shareMilestone(streak: number, handle?: string): void {
  const text = `🔥 ${streak}-day streak on PsalmTune — voting for my faves every single day.`
  const url = handle ? `https://psalmtune.com/u/${handle}` : 'https://psalmtune.com/'
  void shareOrCopy({
    title: `${streak}-day streak on PsalmTune`,
    text,
    url,
    copyText: `${text} ${url}`,
  }).then((outcome) => {
    if (outcome === 'copied') showToast('Copied — paste it anywhere 💜')
  })
}

/** Celebrates whatever just happened to the streak: a rescued streak and/or a milestone.
 * Called after a vote or a daily-heart claim; silent when the day was already earned. */
export function celebrateStreak(result: StreakResult, options: CelebrateOptions = {}): void {
  if (!result.streakAdvanced) return
  if (result.freezeUsed) {
    showToast(`❄️ A streak freeze saved your ${result.currentStreak}-day streak!`)
  }
  const milestone = MILESTONES[result.currentStreak]
  if (!milestone) return
  const streak = result.currentStreak
  showToast(milestone, {
    action: { label: 'Share', onClick: () => shareMilestone(streak, options.handle) },
  })
}
