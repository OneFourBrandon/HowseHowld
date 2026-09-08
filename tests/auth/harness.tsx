// oxlint-disable react/only-export-components -- standalone browser test entry point
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from '../../src/state/AuthContext'
import { AuthGate } from '../../src/components/AuthGate'
import { EmailRecovery } from '../../src/components/EmailRecovery'
import { signOut } from '../../src/lib/api'
function Account() {
  const auth = useAuth()!
  return <><p data-testid="identity">{auth.user?.id}</p><EmailRecovery reminder /><EmailRecovery /><button onClick={() => signOut()}>Sign out</button></>
}
createRoot(document.getElementById('root')!).render(<AuthProvider><AuthGate><Account /></AuthGate></AuthProvider>)
