import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'

/**
 * Shared modal shell: backdrop, Escape-to-close, backdrop-click-to-close, body scroll
 * lock, focus moved into the dialog on open and restored on close, and a Tab/Shift+Tab
 * focus trap. Callers keep their own look by passing `panelClassName`.
 */
interface Props {
  onClose: () => void
  children: ReactNode
  /** id of the heading inside the panel that names the dialog. */
  labelledBy?: string
  /** Accessible name when the panel has no visible heading to point at. */
  label?: string
  /** Classes for the dialog panel — every caller supplies its own surface. */
  panelClassName?: string
  /** Overrides only the layer/scrim part of the backdrop (`z-50 bg-black/40` by default). */
  backdropClassName?: string
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Visible, tabbable descendants in DOM order. Re-read on every Tab, since panels
 * enable/disable their own controls while open. */
function focusableWithin(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && el.getClientRects().length > 0,
  )
}

/** Nested/stacked modals must not fight over `body.overflow` — count the locks. */
let scrollLocks = 0
let restoreOverflow = ''

export function Modal({ onClose, children, labelledBy, label, panelClassName, backdropClassName }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Escape/close callbacks are usually inline arrows, so keep the listener effect from
  // re-running (and re-stealing focus) on every parent render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Focus in on open, focus back out on close — including when the parent simply stops
  // rendering the modal, since this cleanup runs on unmount either way.
  useEffect(() => {
    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const autofocus = panel?.querySelector<HTMLElement>('[data-autofocus],[autofocus]')
    ;(autofocus ?? panel)?.focus()
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    if (scrollLocks === 0) {
      restoreOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    scrollLocks += 1
    return () => {
      scrollLocks -= 1
      if (scrollLocks === 0) document.body.style.overflow = restoreOverflow
    }
  }, [])

  // Document-level so Escape works wherever focus sits — including inside an input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = focusableWithin(panel)
      const active = document.activeElement
      if (items.length === 0) {
        // Nothing to cycle through: park focus on the panel rather than let Tab escape.
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Only a press that both starts and ends on the backdrop closes — a text selection
  // dragged out of the panel shouldn't dismiss it.
  const pressStartedOnBackdrop = useRef(false)
  const onBackdropMouseDown = useCallback((e: ReactMouseEvent) => {
    pressStartedOnBackdrop.current = e.target === e.currentTarget
  }, [])
  const onBackdropClick = useCallback(
    (e: ReactMouseEvent) => {
      if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose()
    },
    [onClose],
  )

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 ${backdropClassName ?? 'z-50 bg-black/40'}`}
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className={`focus:outline-none ${panelClassName ?? ''}`}
      >
        {children}
      </div>
    </div>
  )
}
