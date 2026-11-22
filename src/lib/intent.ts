import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * A page can be opened with something to do straight away, such as "new chore".
 * The sender passes `{ state: { intent } }` when navigating; the page that owns
 * the dialog runs it once and clears it so a refresh does not reopen it.
 */
export type Intent = 'new-chore' | 'new-purchase' | 'settle-up' | 'new-event' | 'schedule-exit'

export const intentState = (intent: Intent) => ({ state: { intent } })

export function useIntent(intent: Intent, run: () => void) {
  const location = useLocation()
  const navigate = useNavigate()
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })
  // Each navigation has its own key, so an intent runs once even when React replays effects.
  const handledKey = useRef<string | null>(null)
  const requested = (location.state as { intent?: Intent } | null)?.intent === intent

  useEffect(() => {
    if (!requested || handledKey.current === location.key) return
    handledKey.current = location.key
    runRef.current()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.key, location.pathname, navigate, requested])
}
