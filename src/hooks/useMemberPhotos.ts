import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ArtistPicture } from '../types'

/** Maps each member to their best (most-voted) photo that fans have tagged them in.
 * Seed images are tagged to the whole group, so this only fills in once members get
 * individually-tagged uploads — members without one fall back to a placeholder. */
export function useMemberPhotos(artistId: string) {
  const [photos, setPhotos] = useState<Record<string, string>>({})

  useEffect(() => {
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('voteCount', 'desc'),
      limit(100),
    )
    getDocs(q).then((snap) => {
      const map: Record<string, string> = {}
      snap.docs.forEach((d) => {
        const pic = d.data() as ArtistPicture
        for (const tag of pic.taggedMembers ?? []) {
          if (tag.artistId === artistId && !map[tag.memberId]) {
            map[tag.memberId] = pic.url
          }
        }
      })
      setPhotos(map)
    })
  }, [artistId])

  return photos
}
