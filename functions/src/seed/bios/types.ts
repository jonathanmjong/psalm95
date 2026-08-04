export interface MemberBio {
  memberId: string
  birthdate?: string // YYYY-MM-DD
  zodiacSign?: string
  heightCm?: number
  weightKg?: number
  interests?: string[]
  favoriteFoods?: string[]
  favoriteAnimal?: string
}

export interface ArtistBio {
  artistId: string
  agency?: string
  influences?: string[]
  members: MemberBio[]
}
