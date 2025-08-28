import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Use a module-level singleton in the browser to avoid multiple GoTrueClient instances
let browserClient: SupabaseClient | null = null;
let mockClient: SupabaseClient | null = null;

export const supabaseBrowser = () => {
  if (typeof window === 'undefined') {
    // In server environments, just create a new client (not persisted)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return browserClient;
};

export const supabaseAdmin = () => {
  throw new Error(
    'supabaseAdmin moved to server-only module: import { supabaseAdmin } from "@/lib/supabaseAdmin"',
  );
};
