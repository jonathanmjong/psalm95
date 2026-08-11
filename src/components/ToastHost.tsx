import { useEffect, useState } from 'react'
import { subscribeToToasts } from '../lib/toast'

interface Toast {
  id: number
  message: string
}

const VISIBLE_MS = 5_000

/** Fixed, non-blocking toast stack. Mounted once in App; never steals focus or input. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    return subscribeToToasts((message) => {
      const id = Date.now() + Math.random()
      setToasts((current) => [...current, { id, message }])
      setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), VISIBLE_MS)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="btn-gradient max-w-sm rounded-full px-5 py-2.5 text-center text-sm font-semibold shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
