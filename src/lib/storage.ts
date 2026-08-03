import { ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'

/** Uploads a picture to the uid-scoped path Storage rules allow this user to write to. Returns the storage path for createPictureDoc to reference. */
export async function uploadArtistPicture(artistId: string, uid: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `artists/${artistId}/uploads/${uid}/${Date.now()}-${safeName}`
  await uploadBytes(ref(storage, path), file)
  return path
}
