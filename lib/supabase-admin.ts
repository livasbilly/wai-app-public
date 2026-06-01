import { createClient } from '@supabase/supabase-js'

// Server-side only — bypasses RLS for admin writes
// Never import this in client components
export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
