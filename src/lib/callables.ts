import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

export const castArtistVote = httpsCallable<
  { artistId: string },
  { weeklyVotesRemaining: number; currentStreak: number }
>(functions, 'castArtistVote')

export const votePicture = httpsCallable<{ pictureId: string; artistId: string }, { voteCount: number }>(
  functions,
  'votePicture',
)

interface TaggedMember {
  artistId: string
  memberId: string
}

export const createPictureDoc = httpsCallable<
  { artistId: string; storagePath: string; taggedMembers?: TaggedMember[] },
  { pictureId: string }
>(functions, 'createPictureDoc')

export const deletePicture = httpsCallable<{ artistId: string; pictureId: string }, { ok: boolean }>(
  functions,
  'deletePicture',
)
