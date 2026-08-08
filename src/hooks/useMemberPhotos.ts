import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ArtistPicture } from '../types'

interface MemberPhotos {
  /** memberId → best (most-voted) photo the member is individually tagged in. */
  byMember: Record<string, string>
  /** The artist's top pictures, used as fallback avatars for untagged members. */
  groupUrls: string[]
}

/** Loads member-tagged photos plus the artist's top group photos. Seed images are
 * group-tagged, so member cards fall back to a group photo until members get tagged. */
export function useMemberPhotos(artistId: string): MemberPhotos {
  const [result, setResult] = useState<MemberPhotos>({ byMember: {}, groupUrls: [] })

  useEffect(() => {
    const q = query(
      collection(db, 'artists', artistId, 'pictures'),
      orderBy('voteCount', 'desc'),
      limit(100),
    )
    getDocs(q).then((snap) => {
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
      setResult({ byMember, groupUrls })
    })
  }, [artistId])

  return result
}
