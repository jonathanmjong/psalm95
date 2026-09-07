/** Minimal non-blocking toast bus — no dependencies, no modals. `ToastHost` (mounted once in
 * App) subscribes; anything can fire a message from anywhere with `showToast`. */

/** Optional call-to-action rendered as a button inside the toast — used by milestone
 * celebrations to offer a share right at the moment worth bragging about. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
}

type Listener = (message: string, options?: ToastOptions) => void

const listeners = new Set<Listener>()

/** `showToast('hi')` still works exactly as before; the second argument is additive. */
export function showToast(message: string, options?: ToastOptions): void {
  listeners.forEach((listener) => listener(message, options))
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
