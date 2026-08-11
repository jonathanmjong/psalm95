/** Minimal non-blocking toast bus — no dependencies, no modals. `ToastHost` (mounted once in
 * App) subscribes; anything can fire a message from anywhere with `showToast`. */
type Listener = (message: string) => void

const listeners = new Set<Listener>()

export function showToast(message: string): void {
  listeners.forEach((listener) => listener(message))
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
