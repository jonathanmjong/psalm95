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
  stale: boolean
}

export interface ArtistSeed {
  id: string
  name: string
  region: Region
  type: ArtistType
  generationId: string
  members: Member[]
  spotifyArtistId?: string
}
