export type Region = 'KR' | 'CN' | 'JP'
export type ArtistType = 'group' | 'solo'

export interface Member {
  memberId: string
  name: string
}

export interface GenerationConfig {
  id: string
  label: string
  region: Region
  years: string
}

export interface MetricValue {
  value: number
  source: string
  updatedAt: string
  stale?: boolean
}

export interface ArtistMetrics {
  popularity: MetricValue
  albumsSold: MetricValue
  ticketSales: MetricValue
}

export interface Artist {
  id: string
  name: string
  region: Region
  type: ArtistType
  generationId: string
  members: Member[]
  metrics: ArtistMetrics
  weeklyVotes: number
  monthlyVotes: number
  yearlyVotes: number
  compositeScore: number
  rank: number
  spotifyArtistId?: string
}

export interface ArtistPicture {
  id: string
  artistId: string
  storagePath: string
  url: string
  uploadedBy: string
  uploadedAt: string
  taggedArtists: string[]
  taggedMembers: { artistId: string; memberId: string }[]
  /** Flattened `${artistId}_${memberId}` keys, for array-contains member filtering. */
  taggedMemberKeys: string[]
  source: 'wikimedia-seed' | 'user-upload'
  attribution?: { author: string; license: string; sourceUrl: string }
  voteCount: number
}

export interface RankingSnapshot {
  date: string
  compositeScore: number
  rank: number
  popularity: number
  weeklyVotes: number
  monthlyVotes: number
  yearlyVotes: number
}
