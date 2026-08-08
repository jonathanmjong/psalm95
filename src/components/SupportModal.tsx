import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createCheckoutSession } from '../lib/callables'

const AMOUNTS = [
  { cents: 300, label: '$3' },
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' },
  { cents: 2500, label: '$25' },
]

export function SupportModal({ onClose }: { onClose: () => void }) {
  const { user, signInWithGoogle } = useAuth()
  const [amount, setAmount] = useState(500)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const support = async () => {
    if (!user) {
      await signInWithGoogle()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data } = await createCheckoutSession({ amount, origin: window.location.origin })
      if (data.url) window.location.href = data.url
      else setError('Could not start checkout. Please try again.')
    } catch {
      setError('Could not start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-[var(--color-surface)] p-6 dark:bg-[var(--color-surface-dark)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">Support PsalmTune 💜</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
            PsalmTune is fan-run and ad-light. A one-time tip helps keep the servers on and the board fair.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a.cents}
              onClick={() => setAmount(a.cents)}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                amount === a.cents
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-hairline)] dark:border-[var(--color-hairline-dark)]'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium transition hover:bg-[var(--color-surface-sunken)] dark:hover:bg-[var(--color-surface-sunken-dark)]"
          >
            Maybe later
          </button>
          <button
            onClick={support}
            disabled={loading}
            className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Redirecting…' : user ? 'Continue to checkout' : 'Sign in to support'}
          </button>
        </div>
        <p className="text-center text-[10px] text-[var(--color-ink-soft)] dark:text-[var(--color-ink-soft-dark)]">
          Secure payment by Stripe. One-time, no subscription.
        </p>
      </div>
    </div>
  )
}
