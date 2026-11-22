import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { fallBackToClassic, getAppearance, syncAppearance } from './lib/appearance'

syncAppearance()

// Register at app startup so Android does not first begin installing the worker
// when the user opens Settings and immediately asks to enable reminders.
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

async function start() {
  // The slate design brings its own stylesheet, fetched only for people who switched it on.
  // If it cannot be fetched, show classic for this visit rather than an unstyled page.
  if (getAppearance().design === 'slate') {
    try {
      await import('./slate/styles')
    } catch {
      fallBackToClassic()
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void start()
