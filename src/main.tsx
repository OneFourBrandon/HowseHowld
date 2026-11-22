import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
// Loaded after index.css so the slate design can build on it. Inert until switched on in Settings.
import './slate/slate.css'
import './slate/charts.css'
import App from './App.tsx'
import { syncAppearance } from './lib/appearance'

syncAppearance()

// Register at app startup so Android does not first begin installing the worker
// when the user opens Settings and immediately asks to enable reminders.
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
