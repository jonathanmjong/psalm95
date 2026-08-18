import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { currentDayIdKST, kstDayIdBefore, currentWeekId } from '../dates'

/**
 * Daily engagement rollup — the two numbers every feature is judged against (per
 * docs/FEATURE_RESEARCH.md): day-7 return and weekly voters. Runs at 00:05 KST and writes
 * one `stats/{yesterdayKST}` doc summarizing the KST day that just ended. No client rules
 * match `stats/`, so these are console/Admin-only.
 *
 * - activeUsers:      users whose streak day (`lastVoteDate` — advanced by a vote OR a
 *                     daily-heart claim) was yesterday
 * - newUsers:         accounts created during yesterday (KST)
 * - weeklyVoters:     users with ≥1 artist vote in the current ISO week at capture time
 * - d7CohortSize /    accounts created exactly 7 KST days before yesterday, and how many of
 *   d7ActiveOnDay7:   them were active yesterday — d7ActiveOnDay7 / d7CohortSize = D7 return
 */
export async function captureEngagementStatsNow(now: Date = new Date()) {
  const db = getFirestore()
  const yesterday = kstDayIdBefore(currentDayIdKST(now), 1)
  const cohortDay = kstDayIdBefore(yesterday, 7)
  const weekId = currentWeekId(now)

  const usersSnap = await db.collection('users').get()

  let activeUsers = 0
  let newUsers = 0
  let weeklyVoters = 0
  let d7CohortSize = 0
  let d7ActiveOnDay7 = 0

  for (const doc of usersSnap.docs) {
    const data = doc.data()
    const lastActionDay = data.lastVoteDate as string | undefined
    const createdAt = data.createdAt as Timestamp | undefined
    const createdDay = createdAt ? currentDayIdKST(createdAt.toDate()) : undefined
    const votesThisWeek = (data.weeklyArtistVotes?.[weekId] as string[] | undefined) ?? []

    if (lastActionDay === yesterday) activeUsers++
    if (createdDay === yesterday) newUsers++
    if (votesThisWeek.length > 0) weeklyVoters++
    if (createdDay === cohortDay) {
      d7CohortSize++
      if (lastActionDay === yesterday) d7ActiveOnDay7++
    }
  }

  await db.doc(`stats/${yesterday}`).set({
    date: yesterday,
    activeUsers,
    newUsers,
    weeklyVoters,
    weekId,
    d7CohortSize,
    d7ActiveOnDay7,
    totalUsers: usersSnap.size,
    capturedAt: FieldValue.serverTimestamp(),
  })

  console.log(
    `Engagement ${yesterday}: ${activeUsers} active, ${newUsers} new, ${weeklyVoters} weekly voters, ` +
      `D7 ${d7ActiveOnDay7}/${d7CohortSize}, ${usersSnap.size} total users.`,
  )
}

export const captureEngagementStats = onSchedule(
  { schedule: '5 15 * * *', timeZone: 'UTC' }, // 00:05 KST
  () => captureEngagementStatsNow(),
)
