import { artistSeeds } from '../artists'
import { batch1Bios } from './batch-1'
import { batch2Bios } from './batch-2'
import { batch3Bios } from './batch-3'
import { batch4Bios } from './batch-4'
import { batch5Bios } from './batch-5'
import { batch6Bios } from './batch-6'
import { batch7Bios } from './batch-7'
import { batch8Bios } from './batch-8'

const allBios = [
  ...batch1Bios,
  ...batch2Bios,
  ...batch3Bios,
  ...batch4Bios,
  ...batch5Bios,
  ...batch6Bios,
  ...batch7Bios,
  ...batch8Bios,
]

const artistById = new Map(artistSeeds.map((a) => [a.id, a]))
let errors = 0

for (const bio of allBios) {
  const artist = artistById.get(bio.artistId)
  if (!artist) {
    console.error(`UNKNOWN ARTIST: bio references artistId '${bio.artistId}' not in artists.ts`)
    errors++
    continue
  }
  const validMemberIds = new Set(artist.members.map((m) => m.memberId))
  for (const memberBio of bio.members) {
    if (!validMemberIds.has(memberBio.memberId)) {
      console.error(`${bio.artistId}: bio has memberId '${memberBio.memberId}' not in artists.ts roster`)
      errors++
    }
  }
}

const coveredArtistIds = new Set(allBios.map((b) => b.artistId))
for (const artist of artistSeeds) {
  if (!coveredArtistIds.has(artist.id)) {
    console.error(`MISSING: artist '${artist.id}' has no bio batch entry at all`)
    errors++
  }
}

console.log(`Checked ${allBios.length} bio entries against ${artistSeeds.length} roster artists.`)
console.log(errors === 0 ? 'All memberIds match. Clean.' : `${errors} issue(s) found.`)
process.exit(errors === 0 ? 0 : 1)
