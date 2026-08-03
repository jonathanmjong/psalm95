import { initializeApp } from 'firebase-admin/app'
import { onCall } from 'firebase-functions/v2/https'

initializeApp()

export const ping = onCall(() => {
  return { ok: true, time: new Date().toISOString() }
})

export { castArtistVote } from './votes'
export { votePicture } from './pictureVotes'
export { createPictureDoc, deletePicture } from './pictures'
export { refreshArtistMetrics } from './metrics/runMetrics'
export { recomputeRankings } from './ranking/recompute'
export { resetWeeklyVotes, resetMonthlyVotes, resetYearlyVotes } from './ranking/periodReset'
export { captureDailySnapshot } from './ranking/dailySnapshot'
export { createCheckoutSession } from './stripe/checkout'
export { stripeWebhook } from './stripe/webhook'
