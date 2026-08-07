import { useState } from 'react'
import { useArtists } from '../hooks/useArtists'
import { GenerationFilter } from '../components/GenerationFilter'
import { ArtistRow } from '../components/ArtistRow'
import { ScoreLegend } from '../components/ScoreLegend'
import { Pagination } from '../components/Pagination'
import { usePageMeta } from '../hooks/usePageMeta'

export function Home() {
  const [generationId, setGenerationId] = useState<string | null>(null)
  const { artists, loading, page, hasMore, nextPage, prevPage } = useArtists(generationId)

  usePageMeta({
    title: "psalm95 — Rank & explore K-pop, C-pop & J-pop artists",
    description:
      'Vote for the K-pop, C-pop and J-pop artists and bands you love and watch them climb the board. Explore member profiles, popularity, discography and concerts on a fan-driven ranking platform.',
    path: '/',
  })

  return (
    <div className="space-y-8">
      <section className="py-12 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">
          The people's ranking.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Vote for your favorite K-pop, C-pop, and J-pop artists. Every week,
          every vote moves the board — make it count.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <GenerationFilter value={generationId} onChange={setGenerationId} />
        <ScoreLegend />
      </div>

      {loading ? (
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
            <ArtistRow key={artist.id} artist={artist} rank={page * 12 + i + 1} />
          ))}
        </div>
      )}

      <Pagination page={page} hasMore={hasMore} loading={loading} onPrev={prevPage} onNext={nextPage} />
    </div>
  )
}
