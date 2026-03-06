import { useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types'

// Singleton: reuse the same client across components
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}

// Hook version for React components — stable reference across renders
export function useSupabase() {
  return useMemo(() => createClient(), [])
}
