import { useParams } from 'react-router-dom'

export function ArtistPage() {
  const { artistId } = useParams()

  return (
    <div>
      <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
        Artist gallery for {artistId} coming next.
      </p>
    </div>
  )
}
