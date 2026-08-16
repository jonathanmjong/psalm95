import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react'

interface Props {
  /** Tooltip body. Kept as a node so callers can lay out richer previews. */
  tip: ReactNode
  children: ReactNode
  /** Which edge of the trigger the bubble hangs off. */
  align?: 'left' | 'right'
  /** Tailwind width class for the bubble. */
  width?: string
}

/**
 * A small hover/focus popover. Opening on focus as well as hover matters: the pure
 * `group-hover:` tooltips this replaces were invisible to keyboard users and never fired on
 * touch, which is where most of these rows are read.
 */
export function HoverTip({ tip, children, align = 'left', width = 'w-64' }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {/* The description has to live on the focusable control itself: screen readers read
          aria-describedby from the *focused* element, and a wrapper div is never focused. */}
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
            'aria-describedby': open ? id : undefined,
          })
        : children}
      {open && (
        <div
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute bottom-full z-30 mb-2 ${width} ${
            align === 'right' ? 'right-0' : 'left-0'
          } max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 text-left text-xs leading-snug shadow-lg dark:border-[var(--color-hairline-dark)] dark:bg-[var(--color-surface-dark)]`}
        >
          {tip}
        </div>
      )}
    </div>
  )
}
