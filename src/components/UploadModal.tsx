import { useState } from 'react'
import type { Member } from '../types'
import { Modal } from './Modal'
import { useAuth } from '../contexts/AuthContext'
import { useUserProfile } from '../hooks/useUserProfile'
import { uploadArtistPicture } from '../lib/storage'
import { createPictureDoc } from '../lib/callables'

/** Mirrors MAX_ACTIVE_UPLOADS in the createPictureDoc callable. */
const MAX_ACTIVE_UPLOADS = 3
const LIMIT_HINT = `You already have ${MAX_ACTIVE_UPLOADS} active uploads — the maximum. Open one of your own pictures in the gallery and hit Delete to free a slot.`

interface Props {
  artistId: string
  members: Member[]
  onClose: () => void
  onUploaded: () => void
}

export function UploadModal({ artistId, members, onClose, onUploaded }: Props) {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [file, setFile] = useState<File | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [confirmedRights, setConfirmedRights] = useState(false)
  const [credit, setCredit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atLimit = (profile?.activeUploadCount ?? 0) >= MAX_ACTIVE_UPLOADS

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((m) => m !== memberId) : [...prev, memberId],
    )
  }

  const handleSubmit = async () => {
    if (!user || !file || !confirmedRights || atLimit) return
    setSubmitting(true)
    setError(null)
    try {
      const storagePath = await uploadArtistPicture(artistId, user.uid, file)
      await createPictureDoc({
        artistId,
        storagePath,
        taggedMembers: selectedMembers.map((memberId) => ({ artistId, memberId })),
        credit: credit.trim() || undefined,
      })
      onUploaded()
      onClose()
    } catch (err) {
      if ((err as { code?: string }).code === 'functions/resource-exhausted') {
        setError(LIMIT_HINT)
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="upload-modal-title"
      panelClassName="w-full max-w-md space-y-4 rounded-2xl bg-[var(--color-surface)] p-6 dark:bg-[var(--color-surface-dark)]"
    >
      <h2 id="upload-modal-title" className="text-lg font-semibold">
        Upload a picture
      </h2>

      {atLimit && (
        <p className="rounded-2xl bg-[var(--color-surface-sunken)] px-4 py-3 text-sm text-amber-600 dark:bg-[var(--color-surface-sunken-dark)]">
          {LIMIT_HINT}
        </p>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />

      {members.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Which members are in this picture?</p>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <button
                key={member.memberId}
                type="button"
                onClick={() => toggleMember(member.memberId)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedMembers.includes(member.memberId)
                    ? 'border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] text-white'
                    : 'border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
                }`}
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fansite photographers are protective of their work, and an uncredited repost is one
          of the fastest ways for a fan site to get piled on. Optional, but asked for by name. */}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Photo credit (optional)</span>
        <input
          type="text"
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
          maxLength={120}
          placeholder="Photographer or source, e.g. @fansitename"
          className="w-full rounded-xl border border-[var(--color-hairline)] bg-transparent px-3 py-2 text-sm dark:border-[var(--color-hairline-dark)]"
        />
        <span className="block text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Shown under the photo. If it isn’t yours, credit whoever took it.
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmedRights}
          onChange={(e) => setConfirmedRights(e.target.checked)}
          className="mt-0.5"
        />
        I confirm I have the rights to share this image.
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-full px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!file || !confirmedRights || submitting || atLimit}
          className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </Modal>
  )
}
