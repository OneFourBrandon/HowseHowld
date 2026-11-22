import { type RefObject, useEffect, useState } from 'react'

/** Close a popover on Escape or a press outside it, saying which it was. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: (reason: 'escape' | 'outside') => void,
) {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close('outside')
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('escape')
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [close, open, ref])
}

/** A clock for time-sensitive views. Ticks every 30 seconds unless told otherwise. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

const OPEN_DIALOG = '[role="dialog"][aria-modal="true"]'

/**
 * The dialogs shared with the classic design do not manage focus. While slate
 * is showing, this moves focus into a dialog as it opens, unless something
 * inside it already took focus, and back to where it was when the dialog closes.
 */
export function useDialogFocus() {
  useEffect(() => {
    let lastOutside: HTMLElement | null = null
    let returnTo: HTMLElement | null = null
    let current: HTMLElement | null = null

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && !target.closest(OPEN_DIALOG)) lastOutside = target
    }
    const sync = () => {
      const dialog = document.querySelector<HTMLElement>(OPEN_DIALOG)
      if (dialog === current) return
      if (dialog) {
        if (!current) returnTo = lastOutside
        current = dialog
        if (!dialog.contains(document.activeElement)) {
          dialog.tabIndex = -1
          dialog.focus({ preventScroll: true })
        }
        return
      }
      current = null
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true })
      returnTo = null
    }

    document.addEventListener('focusin', onFocusIn)
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    sync()
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      observer.disconnect()
    }
  }, [])
}
