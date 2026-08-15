import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const FACTORS = ['popularity', 'weeklyVotes', 'monthlyVotes'] as const
const WEIGHT = 1 / 3
const BATCH_SIZE = 400
/** How many top-voted picture URLs to denormalize onto each artist (row avatar + thumbnails). */
const TOP_PICTURE_COUNT = 5
/** How deep to scan an artist's photos when building the member-avatar map. The artist page
 * used to run this scan itself on every visit (100 docs); doing it hourly here makes it free
 * at read time, and catches freshly uploaded tagged photos that carry no votes yet. */
const MEMBER_PHOTO_SCAN = 60
/** Concurrency cap for the per-artist top-pictures queries. */
const PICTURE_QUERY_CHUNK = 20

/**
 * Vote factors are normalized against at least this many votes. Plain min-max makes the
 * current leader 100 no matter how thin the vote base is, so with three votes on the whole
 * board a single vote outscored an artist with millions of listeners. Scaling against a
 * floor keeps one vote worth ~4 points instead of 100; once real weekly volume passes the
 * floor the true maximum takes over and this stops having any effect.
 */
const VOTE_SCALE_FLOOR = 25

function rawValue(data: FirebaseFirestore.DocumentData, factor: (typeof FACTORS)[number]): number {
  if (factor === 'weeklyVotes' || factor === 'monthlyVotes') return data[factor] ?? 0
  return data.metrics?.[factor]?.value ?? 0
}

/** Min-max normalizes a factor to 0-100 across all artists. Zero variance (or all-stale/zero
 * data) normalizes to 0 for every artist rather than dividing by zero. `floor` raises the top
 * of the scale so a near-empty factor can't hand its leader a perfect score. */
function normalize(values: number[], floor = 0): number[] {
  const min = Math.min(...values)
  const max = Math.max(Math.max(...values), floor)
  if (max === min) return values.map(() => 0)
  return values.map((v) => ((v - min) / (max - min)) * 100)
}

export const recomputeRankings = onSchedule({ schedule: 'every 1 hours', timeoutSeconds: 300 }, async () => {
  const db = getFirestore()
  const snap = await db.collection('artists').get()
  const docs = snap.docs

  const normalizedByFactor = Object.fromEntries(
    FACTORS.map((factor) => [
      factor,
      normalize(
        docs.map((d) => rawValue(d.data(), factor)),
        factor === 'popularity' ? 0 : VOTE_SCALE_FLOOR,
      ),
    ]),
  )

  const compositeScores = docs.map((_, i) =>
    FACTORS.reduce((sum, factor) => sum + WEIGHT * normalizedByFactor[factor][i], 0),
  )

  const ranked = docs
    .map((doc, i) => ({
      doc,
      compositeScore: compositeScores[i],
      // The 0-100 values the composite is actually built from, denormalized onto the artist so
      // the score bar can render the same numbers the ranking used. Without them the client has
      // no way to reconstruct a roster-wide min-max from a single doc.
      factors: Object.fromEntries(FACTORS.map((f) => [f, normalizedByFactor[f][i]])) as Record<
        (typeof FACTORS)[number],
        number
      >,
      name: doc.data().name as string,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore || a.name.localeCompare(b.name))

  // Top-voted picture URLs per artist, denormalized so list rows need zero picture queries.
  // Chunked so ~107 subcollection queries don't all fire at once.
  const topPictureUrls = new Map<string, string[]>()
  const memberPhotoUrls = new Map<string, Record<string, string>>()
  for (let i = 0; i < ranked.length; i += PICTURE_QUERY_CHUNK) {
    await Promise.all(
      ranked.slice(i, i + PICTURE_QUERY_CHUNK).map(async ({ doc }) => {
        try {
          const pics = await doc.ref
            .collection('pictures')
            .orderBy('voteCount', 'desc')
            .limit(MEMBER_PHOTO_SCAN)
            .get()
          const urls = pics.docs.map((p) => p.data().url as string).filter(Boolean)
          topPictureUrls.set(doc.id, urls.slice(0, TOP_PICTURE_COUNT))

          // Best (most-voted) photo each member is individually tagged in.
          const byMember: Record<string, string> = {}
          for (const p of pics.docs) {
            const data = p.data()
            const url = data.url as string | undefined
            if (!url) continue
            for (const tag of (data.taggedMembers ?? []) as { artistId: string; memberId: string }[]) {
              if (tag.artistId === doc.id && !byMember[tag.memberId]) byMember[tag.memberId] = url
            }
          }
          memberPhotoUrls.set(doc.id, byMember)
        } catch (err) {
          console.error(`Top pictures for ${doc.id} failed:`, err)
          topPictureUrls.set(doc.id, [])
          memberPhotoUrls.set(doc.id, {})
        }
      }),
    )
  }

  for (let i = 0; i < ranked.length; i += BATCH_SIZE) {
    const batch = db.batch()
    ranked.slice(i, i + BATCH_SIZE).forEach(({ doc, compositeScore, factors }, offset) => {
      batch.update(doc.ref, {
        compositeScore,
        factors,
        rank: i + offset + 1,
        topPictureUrls: topPictureUrls.get(doc.id) ?? [],
        memberPhotoUrls: memberPhotoUrls.get(doc.id) ?? {},
      })
    })
    await batch.commit()
  }

  // Compact roster index for list surfaces (search, birthdays strip, daily-heart card, battle
  // card, hall-of-fame labels): everything they render, none of the heavy member bios. At ~107
  // artists this serializes to roughly 150-250 KB (the picture URLs dominate) — far below the
  // 1 MiB doc limit and a fraction of the ~1 MB full-roster fetch it replaces.
  const indexArtists = ranked.map(({ doc, compositeScore, factors }, i) => {
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
      factors,
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
