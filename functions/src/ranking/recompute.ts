import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const FACTORS = ['popularity', 'weeklyVotes', 'monthlyVotes'] as const
const WEIGHT = 1 / 3
const BATCH_SIZE = 400
/** How many top-voted picture URLs to denormalize onto each artist (row avatar + thumbnails). */
const TOP_PICTURE_COUNT = 5
/** Concurrency cap for the per-artist top-pictures queries. */
const PICTURE_QUERY_CHUNK = 20

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

export const recomputeRankings = onSchedule({ schedule: 'every 1 hours', timeoutSeconds: 300 }, async () => {
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

  // Top-voted picture URLs per artist, denormalized so list rows need zero picture queries.
  // Chunked so ~107 subcollection queries don't all fire at once.
  const topPictureUrls = new Map<string, string[]>()
  for (let i = 0; i < ranked.length; i += PICTURE_QUERY_CHUNK) {
    await Promise.all(
      ranked.slice(i, i + PICTURE_QUERY_CHUNK).map(async ({ doc }) => {
        try {
          const pics = await doc.ref
            .collection('pictures')
            .orderBy('voteCount', 'desc')
            .limit(TOP_PICTURE_COUNT)
            .get()
          topPictureUrls.set(
            doc.id,
            pics.docs.map((p) => p.data().url as string).filter(Boolean),
          )
        } catch (err) {
          console.error(`Top pictures for ${doc.id} failed:`, err)
          topPictureUrls.set(doc.id, [])
        }
      }),
    )
  }

  for (let i = 0; i < ranked.length; i += BATCH_SIZE) {
    const batch = db.batch()
    ranked.slice(i, i + BATCH_SIZE).forEach(({ doc, compositeScore }, offset) => {
      batch.update(doc.ref, {
        compositeScore,
        rank: i + offset + 1,
        topPictureUrls: topPictureUrls.get(doc.id) ?? [],
      })
    })
    await batch.commit()
  }

  // Compact roster index for list surfaces (search, birthdays strip, daily-heart card, battle
  // card, hall-of-fame labels): everything they render, none of the heavy member bios. At ~107
  // artists this serializes to roughly 150-250 KB (the picture URLs dominate) — far below the
  // 1 MiB doc limit and a fraction of the ~1 MB full-roster fetch it replaces.
  const indexArtists = ranked.map(({ doc, compositeScore }, i) => {
    const data = doc.data()
    const members = ((data.members as { memberId: string; name: string; birthdate?: string }[]) ?? []).map(
      (m) => ({
        memberId: m.memberId,
        name: m.name,
        ...(m.birthdate ? { birthdate: m.birthdate } : {}),
      }),
    )
    return {
      id: doc.id,
      name: data.name,
      region: data.region,
      type: data.type,
      generationId: data.generationId,
      rank: i + 1,
      compositeScore,
      weeklyVotes: data.weeklyVotes ?? 0,
      monthlyVotes: data.monthlyVotes ?? 0,
      yearlyVotes: data.yearlyVotes ?? 0,
      metrics: {
        popularity: data.metrics?.popularity?.value ?? 0,
      },
      ...(data.fandomName ? { fandomName: data.fandomName } : {}),
      ...(data.fandomColorName ? { fandomColorName: data.fandomColorName } : {}),
      ...(data.fandomColorHex ? { fandomColorHex: data.fandomColorHex } : {}),
      topPictureUrls: topPictureUrls.get(doc.id) ?? [],
      members,
    }
  })
  await db.doc('config/artistIndex').set({ updatedAt: FieldValue.serverTimestamp(), artists: indexArtists })

  const indexBytes = JSON.stringify(indexArtists).length
  console.log(
    `Recomputed rankings for ${ranked.length} artists; artistIndex ~${Math.round(indexBytes / 1024)} KB.`,
  )
})
