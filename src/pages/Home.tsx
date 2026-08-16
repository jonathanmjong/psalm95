import { Fragment, useMemo, useState } from 'react'
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
  const { artists, loading, error, page, hasMore, nextPage, prevPage } = useArtists(generationId)
  const { artists: allArtists, loading: allLoading } = useArtistIndex()

  usePageMeta({
    title: 'PsalmTune — Rank & explore K-pop, C-pop & J-pop artists',
    description:
      'Vote for the K-pop, C-pop and J-pop artists and bands you love and watch them climb the board. Explore member profiles and live popularity rankings on a fan-driven platform.',
    path: '/',
  })

  const query = search.trim().toLowerCase()
  const searching = query.length > 0

  /** Row index the battle / daily-heart cards are slotted in after — the third row normally,
   *  the last one on a short page so the cards never fall off the list entirely. */
  const cardSlotIndex = Math.min(2, artists.length - 1)

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
    <div className="space-y-6 sm:space-y-8">
      {/* Deliberately short: on a 390px phone every pixel here is a pixel the ranking — the
          actual product — is pushed below the fold. The roster size is read live rather than
          written in, so the claim can't go stale. */}
      <section className="hero-glow -mx-6 rounded-3xl px-6 py-6 text-center sm:py-10">
        <h1 className="text-gradient text-3xl font-extrabold tracking-tight sm:text-5xl">
          K-pop, C-pop &amp; J-pop, ranked by fans.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-base text-[var(--color-ink-soft)] sm:mt-4 sm:text-lg dark:text-[var(--color-ink-soft-dark)]">
          {allArtists.length > 0 ? allArtists.length : 'Over 100'} artists on the board. You get 3 votes a
          week — they reset every Monday.
        </p>
      </section>

      <SearchBar value={search} onChange={setSearch} />

      {!searching && <BirthdaysStrip artists={allArtists} />}

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
          <p className="py-12 text-center text-sm break-words text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            No artists or members match “{search.trim().slice(0, 80)}”.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm break-words text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              {results.length} result{results.length === 1 ? '' : 's'} for “{search.trim().slice(0, 80)}”
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
      ) : loading && artists.length === 0 ? (
        // --- Ranked, paginated list ---
        // Only announce loading when there is genuinely nothing to show: a cached page
        // paints instantly on a repeat visit, and paging keeps the current rows up
        // (Pagination is disabled meanwhile) instead of collapsing to this message.
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Loading rankings…
        </p>
      ) : artists.length === 0 && error ? (
        // The board is unreachable, not empty — claiming otherwise blames the roster for a
        // network failure and leaves the visitor with nothing to act on.
        <div className="space-y-3 py-12 text-center">
          <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            Couldn’t load the board just now.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-gradient inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      ) : artists.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No artists found for this generation yet.
        </p>
      ) : (
        <div className="space-y-2">
          {artists.map((artist, i) => (
            <Fragment key={artist.id}>
              <ArtistRow
                artist={artist}
                rank={page * 12 + i + 1}
                picturesOpen={picturesRowId === artist.id}
                onPicturesToggle={(open) => setPicturesRowId(open ? artist.id : null)}
              />
              {/* The board is the fold; the battle and daily-heart cards sit just under the
                  first few rows, where a visitor has already seen what this place is. */}
              {i === cardSlotIndex && (
                <div className="space-y-4 py-2">
                  <BattleCard />
                  <DailyHeartCard />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {!searching && (
        <Pagination
          page={page}
          hasMore={hasMore}
          loading={loading}
          onPrev={prevPage}
          onNext={nextPage}
          totalPages={
            // Only when a generation filter isn't narrowing the board — the index count
            // would otherwise overstate how many pages the current filter actually has.
            !generationId && allArtists.length ? Math.ceil(allArtists.length / 12) : undefined
          }
        />
      )}
    </div>
  )
}
