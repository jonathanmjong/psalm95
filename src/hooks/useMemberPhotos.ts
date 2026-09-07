import { useEffect, useState } from 'react'
import { collection, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { swrQuery } from '../lib/swr'
import type { Artist, ArtistPicture } from '../types'

interface MemberPhotos {
  /** memberId → best (most-voted) photo the member is individually tagged in. */
  byMember: Record<string, string>
  /** The artist's top pictures, used as fallback avatars for untagged members. */
  groupUrls: string[]
}

/**
 * Member-card avatars. Both halves are denormalized onto the artist doc hourly by
 * `recomputeRankings`, so the common path costs zero extra reads — this used to scan 100
 * picture docs on every artist-page visit. The scan only runs for artist docs written
 * before that job started denormalizing.
 */
export function useMemberPhotos(artistId: string, artist?: Artist | null): MemberPhotos {
  const denormalized = artist?.memberPhotoUrls
  const [result, setResult] = useState<MemberPhotos>({ byMember: {}, groupUrls: [] })

  useEffect(() => {
    // Denormalized data present (even an empty map — nobody is tagged yet): nothing to fetch.
    if (denormalized) {
      setResult({ byMember: denormalized, groupUrls: artist?.topPictureUrls ?? [] })
      return
    }
    let active = true
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('voteCount', 'desc'),
      limit(60),
    )
    swrQuery(
      q,
      (snap) => {
        const byMember: Record<string, string> = {}
        const groupUrls: string[] = []
        snap.docs.forEach((d) => {
          const pic = d.data() as ArtistPicture
          if (pic.url) groupUrls.push(pic.url)
          for (const tag of pic.taggedMembers ?? []) {
            if (tag.artistId === artistId && !byMember[tag.memberId]) {
              byMember[tag.memberId] = pic.url
            }
          }
        })
        return { byMember, groupUrls }
      },
      (photos) => {
        if (active) setResult(photos)
      },
    ).catch(() => {})
    return () => {
      active = false
    }
  }, [artistId, denormalized, artist?.topPictureUrls])

  return result
}
