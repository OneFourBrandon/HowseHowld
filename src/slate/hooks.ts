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
