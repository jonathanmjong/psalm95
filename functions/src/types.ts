export type Region = 'KR' | 'CN' | 'JP'
export type ArtistType = 'group' | 'solo'

export interface Member {
  memberId: string
  name: string
  birthdate?: string // ISO date, YYYY-MM-DD
  zodiacSign?: string
  heightCm?: number
  weightKg?: number
  interests?: string[]
  favoriteFoods?: string[]
  favoriteAnimal?: string
  position?: string
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
  agency?: string
  influences?: string[]
  debutDate?: string
  fandomName?: string
  fandomColorName?: string
  fandomColorHex?: string
}
