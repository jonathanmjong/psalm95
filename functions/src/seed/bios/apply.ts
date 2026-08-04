import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { batch1Bios } from './batch-1'
import { batch2Bios } from './batch-2'
import { batch3Bios } from './batch-3'
import { batch4Bios } from './batch-4'
import { batch5Bios } from './batch-5'
import { batch6Bios } from './batch-6'
import { batch7Bios } from './batch-7'
import { batch8Bios } from './batch-8'
import type { Member } from '../../types'

const PROJECT_ID = 'jj-psalm95'

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
const db = getFirestore()

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

async function applyBio(bio: (typeof allBios)[number]) {
  const ref = db.doc(`artists/${bio.artistId}`)
  const snap = await ref.get()
  if (!snap.exists) {
    console.error(`Skipping ${bio.artistId}: no such artist doc in Firestore.`)
    return
  }

  const existingMembers = (snap.data()?.members ?? []) as Member[]
  const bioByMemberId = new Map(bio.members.map((m) => [m.memberId, m]))

  const mergedMembers = existingMembers.map((member) => {
    const memberBio = bioByMemberId.get(member.memberId)
    return memberBio ? { ...member, ...memberBio, memberId: member.memberId, name: member.name } : member
  })

  const update: Record<string, unknown> = { members: mergedMembers }
  if (bio.agency) update.agency = bio.agency
  if (bio.influences && bio.influences.length > 0) update.influences = bio.influences

  await ref.update(update)
  console.log(`Applied bio for ${bio.artistId} (${bio.members.length} member(s) with data).`)
}

async function main() {
  for (const bio of allBios) {
    await applyBio(bio)
  }
  console.log(`Done. Applied bios for ${allBios.length} artists.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
