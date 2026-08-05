import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'

const FACTORS = ['popularity', 'discography', 'ticketSales', 'weeklyVotes', 'monthlyVotes'] as const
const WEIGHT = 0.2
const BATCH_SIZE = 400

function rawValue(data: FirebaseFirestore.DocumentData, factor: (typeof FACTORS)[number]): number {
  if (factor === 'weeklyVotes' || factor === 'monthlyVotes') return data[factor] ?? 0
  return data.metrics?.[factor]?.value ?? 0
}

/** Min-max normalizes a factor to 0-100 across all artists. Zero variance (or all-stale/zero
 * data) normalizes to 0 for every artist rather than dividing by zero. */
function normalize(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 0)
  return values.map((v) => ((v - min) / (max - min)) * 100)
}

export const recomputeRankings = onSchedule('every 1 hours', async () => {
  const db = getFirestore()
  const snap = await db.collection('artists').get()
  const docs = snap.docs

  const normalizedByFactor = Object.fromEntries(
    FACTORS.map((factor) => [factor, normalize(docs.map((d) => rawValue(d.data(), factor)))]),
  )

  const compositeScores = docs.map((_, i) =>
    FACTORS.reduce((sum, factor) => sum + WEIGHT * normalizedByFactor[factor][i], 0),
  )

  const ranked = docs
    .map((doc, i) => ({ doc, compositeScore: compositeScores[i], name: doc.data().name as string }))
    .sort((a, b) => b.compositeScore - a.compositeScore || a.name.localeCompare(b.name))

  for (let i = 0; i < ranked.length; i += BATCH_SIZE) {
    const batch = db.batch()
    ranked.slice(i, i + BATCH_SIZE).forEach(({ doc, compositeScore }, offset) => {
      batch.update(doc.ref, { compositeScore, rank: i + offset + 1 })
    })
    await batch.commit()
  }

  console.log(`Recomputed rankings for ${ranked.length} artists.`)
})
