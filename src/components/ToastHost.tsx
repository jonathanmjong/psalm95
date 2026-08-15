import { useEffect, useState } from 'react'
import { subscribeToToasts, type ToastAction } from '../lib/toast'

interface Toast {
  id: number
  message: string
  action?: ToastAction
}

const VISIBLE_MS = 5_000
/** Actionable toasts stay up longer — a button nobody has time to hit is just noise. */
const ACTION_VISIBLE_MS = 9_000

/** Fixed, non-blocking toast stack. Mounted once in App; never steals focus or input. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return subscribeToToasts((message, options) => {
      const id = Date.now() + Math.random()
      const action = options?.action
      setToasts((current) => [...current, { id, message, action }])
      setTimeout(
        () => setToasts((current) => current.filter((t) => t.id !== id)),
        action ? ACTION_VISIBLE_MS : VISIBLE_MS,
      )
    })
  }, [])

  const dismiss = (id: number) => setToasts((current) => current.filter((t) => t.id !== id))

  // The live region is always in the DOM, even with nothing to show: screen readers only
  // announce insertions into a region that already existed when the toast arrives.
  // Empty, it's a zero-height, pointer-transparent box.
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // Only actionable toasts take pointer events, so a plain toast can never
          // swallow a tap meant for the page underneath it.
          className={`btn-gradient flex max-w-sm items-center gap-3 rounded-full py-2.5 pl-5 text-center text-sm font-semibold shadow-lg ${
            toast.action ? 'pointer-events-auto pr-2' : 'pr-5'
          }`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                dismiss(toast.id)
              }}
              className="min-h-10 shrink-0 rounded-full bg-white/25 px-4 text-sm font-bold transition hover:bg-white/40"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
