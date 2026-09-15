import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export interface Battle {
  weekId: string
  aArtistId: string
  aName: string
  aRegion: 'KR' | 'CN' | 'JP'
  bArtistId: string
  bName: string
  bRegion: 'KR' | 'CN' | 'JP'
  aVotes: number
  bVotes: number
}

/** Live subscription to the current weekly battle, plus whether the signed-in user
 * has already voted in it (which side). */
export function useBattle() {
  const { user } = useAuth()
  const [battle, setBattle] = useState<Battle | null>(null)
  const [loading, setLoading] = useState(true)
  const [votedChoice, setVotedChoice] = useState<string | null>(null)
  /** Bumped per lookup so a slow delivery from a superseded request — the signed-in user
   *  changed, or the battle rolled over, before the previous getDoc resolved — can't write a
   *  stale vote choice over the current one. */
  const request = useRef(0)

  useEffect(() => {
    return onSnapshot(doc(db, 'battles', 'current'), (snap) => {
      setBattle(snap.exists() ? (snap.data() as Battle) : null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const id = ++request.current
    if (!user || !battle) {
      setVotedChoice(null)
      return
    }
    getDoc(doc(db, 'battleVotes', `${user.uid}_${battle.weekId}`)).then((s) => {
      if (id !== request.current) return
      setVotedChoice(s.exists() ? (s.data().choice as string) : null)
    })
  }, [user, battle])

  return { battle, loading, votedChoice, setVotedChoice }
}
