export function Home() {
  return (
    <div className="space-y-8">
      <section className="py-12 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">
          The people's ranking.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Vote for your favorite K-pop, C-pop, and J-pop artists. Every week,
          every vote moves the board.
        </p>
      </section>
      <p className="text-center text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Ranked artist list coming next.
      </p>
    </div>
  )
}
