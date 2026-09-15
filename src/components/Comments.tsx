import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useComments } from '../hooks/useComments'

const MAX = 500

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function Comments({ artistId }: { artistId: string }) {
  const { user, signInWithGoogle } = useAuth()
  const { comments, loading } = useComments(artistId)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  /** Which comment (by id) has its inline "Delete this comment?" confirm open — a fat-tap on
   *  "Delete" used to remove it immediately, with no undo. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const submit = async () => {
    const trimmed = text.trim()
    if (!user || !trimmed || posting) return
    setPosting(true)
    try {
      await addDoc(collection(db, 'artists', artistId, 'comments'), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: trimmed.slice(0, MAX),
        createdAt: serverTimestamp(),
      })
      setText('')
    } catch {
      // create rejected (e.g. offline) — leave the text so the user can retry
    } finally {
      setPosting(false)
    }
  }

  const removeComment = async (commentId: string) => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'artists', artistId, 'comments', commentId))
    } catch {
      // delete rejected (e.g. offline) — leave the confirm open so the user can retry
    } finally {
      setDeleting(false)
      setConfirmingId(null)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        Comments{comments.length > 0 && <span className="text-[var(--color-ink-soft)]"> · {comments.length}</span>}
      </h2>

      {user ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder="Share the love — what makes them your bias?"
            rows={2}
            className="w-full resize-none rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)] dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
              {text.length}/{MAX}
            </span>
            <button
              onClick={submit}
              disabled={!text.trim() || posting}
              className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => signInWithGoogle()}
          className="rounded-full border border-[var(--color-hairline)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:border-[var(--color-hairline-dark)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
        >
          Sign in to comment
        </button>
      )}

      {loading ? null : comments.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          No comments yet — be the first.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.photoURL ? (
                <img src={c.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-surface-sunken)] dark:bg-[var(--color-surface-sunken-dark)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{c.displayName ?? 'Fan'}</span>
                  <span className="text-xs text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                    {c.createdAt ? timeAgo(c.createdAt.toMillis()) : ''}
                  </span>
                  {user?.uid === c.uid &&
                    (confirmingId === c.id ? (
                      <span className="ml-auto flex items-center gap-2 text-xs">
                        <span className="text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
                          Delete?
                        </span>
                        <button
                          onClick={() => removeComment(c.id)}
                          disabled={deleting}
                          className="font-semibold text-red-500 hover:opacity-80 disabled:opacity-50"
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={deleting}
                          className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] disabled:opacity-50 dark:text-[var(--color-ink-soft-dark)]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(c.id)}
                        className="ml-auto text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] dark:text-[var(--color-ink-soft-dark)]"
                      >
                        Delete
                      </button>
                    ))}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
