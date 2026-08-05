export interface MemberBio {
  memberId: string
  birthdate?: string // YYYY-MM-DD
  zodiacSign?: string
  heightCm?: number
  weightKg?: number
  interests?: string[]
  favoriteFoods?: string[]
  favoriteAnimal?: string
  position?: string // e.g. "Leader, Main Vocalist"
}

export interface ArtistBio {
  artistId: string
  agency?: string
  influences?: string[]
  debutDate?: string // YYYY-MM-DD
  fandomName?: string
  fandomColorName?: string
  fandomColorHex?: string
  members: MemberBio[]
}
