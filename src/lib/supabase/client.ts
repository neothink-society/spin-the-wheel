import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Use publishable key (new sb_ format) with fallback to legacy JWT anon key
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}
