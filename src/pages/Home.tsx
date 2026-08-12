import { useMemo, useState } from 'react'
import { useArtists } from '../hooks/useArtists'
import { useArtistIndex } from '../hooks/useArtistIndex'
import { GenerationFilter } from '../components/GenerationFilter'
import { SearchBar } from '../components/SearchBar'
import { BirthdaysStrip } from '../components/BirthdaysStrip'
import { BattleCard } from '../components/BattleCard'
import { DailyHeartCard } from '../components/DailyHeartCard'
import { ArtistRow } from '../components/ArtistRow'
import { ScoreLegend } from '../components/ScoreLegend'
import { Pagination } from '../components/Pagination'
import { usePageMeta } from '../hooks/usePageMeta'

export function Home() {
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  /** Id of the row whose inline pictures panel is open — at most one at a time,
   *  on both the ranked list and the search results. */
  const [picturesRowId, setPicturesRowId] = useState<string | null>(null)
  const { artists, loading, page, hasMore, nextPage, prevPage } = useArtists(generationId)
  const { artists: allArtists, loading: allLoading } = useArtistIndex()

  usePageMeta({
    title: 'PsalmTune — Rank & explore K-pop, C-pop & J-pop artists',
    description:
      'Vote for the K-pop, C-pop and J-pop artists and bands you love and watch them climb the board. Explore member profiles and live popularity rankings on a fan-driven platform.',
    path: '/',
  })

  const query = search.trim().toLowerCase()
  const searching = query.length > 0

  // Instant client-side search over the full roster — matches artist name or any
  // member name, and respects the generation filter if one is selected.
  const results = useMemo(() => {
    if (!searching) return []
    return allArtists.filter((a) => {
      if (generationId && a.generationId !== generationId) return false
      if (a.name.toLowerCase().includes(query)) return true
      return a.members.some((m) => m.name.toLowerCase().includes(query))
    })
  }, [searching, allArtists, generationId, query])

  return (
    <div className="space-y-8">
      <section className="hero-glow -mx-6 rounded-3xl px-6 py-14 text-center sm:py-16">
        <h1 className="text-gradient text-5xl font-extrabold tracking-tight sm:text-6xl">
          The people's ranking.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Vote for your favorite K-pop, C-pop, and J-pop artists. Every week, every vote moves the board —
          make it count.
        </p>
      </section>

      <SearchBar value={search} onChange={setSearch} />

      {!searching && <BattleCard />}
      {!searching && <BirthdaysStrip artists={allArtists} />}
      {!searching && <DailyHeartCard />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GenerationFilter value={generationId} onChange={setGenerationId} />
        <ScoreLegend />
      </div>

      {searching ? (
        // --- Search results ---
        allLoading ? (
          <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Searching…
          </p>
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            No artists or members match “{search.trim()}”.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              {results.length} result{results.length === 1 ? '' : 's'} for “{search.trim()}”
            </p>
            {results.map((artist) => (
              <ArtistRow
                key={artist.id}
                artist={artist}
                rank={artist.rank}
                picturesOpen={picturesRowId === artist.id}
                onPicturesToggle={(open) => setPicturesRowId(open ? artist.id : null)}
              />
            ))}
          </div>
        )
      ) : loading ? (
        // --- Ranked, paginated list ---
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading rankings…
        </p>
      ) : artists.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No artists found for this generation yet.
        </p>
      ) : (
        <div className="space-y-2">
          {artists.map((artist, i) => (
            <ArtistRow
              key={artist.id}
              artist={artist}
              rank={page * 12 + i + 1}
              picturesOpen={picturesRowId === artist.id}
              onPicturesToggle={(open) => setPicturesRowId(open ? artist.id : null)}
            />
          ))}
        </div>
      )}

      {!searching && (
        <Pagination page={page} hasMore={hasMore} loading={loading} onPrev={prevPage} onNext={nextPage} />
      )}
    </div>
  )
}
