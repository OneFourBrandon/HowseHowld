import { createClient } from '@supabase/supabase-js'

// These are public, local-only credentials from the Supabase CLI defaults.
// Production builds never fall back to them and must receive hosted values.
const localSupabaseUrl = 'http://127.0.0.1:54321'
const localSupabasePublishableKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const urlIsPlaceholder = configuredUrl?.includes('your-project-ref')
const keyIsPlaceholder = configuredKey?.includes('your_key')
const useLocalDefaults =
  import.meta.env.DEV
  && (!configuredUrl || !configuredKey || urlIsPlaceholder || keyIsPlaceholder)
const supabaseUrl = useLocalDefaults ? localSupabaseUrl : configuredUrl
const supabasePublishableKey = useLocalDefaults
  ? localSupabasePublishableKey
  : configuredKey
const forceDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

export const hasSupabaseConfig =
  !forceDemoMode && Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 8 } },
    })
  : null
