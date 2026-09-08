export function pendingJoin(): 'join' | 'recover' | null {
  try { const value = sessionStorage.getItem('howse:pending-join'); return value === 'join' || value === 'recover' ? value : null } catch { return null }
}
export function setPendingJoin(mode: 'join' | 'recover' | null) {
  try { if (mode) sessionStorage.setItem('howse:pending-join', mode); else sessionStorage.removeItem('howse:pending-join') } catch { /* In-memory form still protects this attempt. */ }
}
