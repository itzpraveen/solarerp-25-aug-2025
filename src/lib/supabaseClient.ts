import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMockClient } from '@/lib/supabaseMock';

// Use a module-level singleton in the browser to avoid multiple GoTrueClient instances
let browserClient: SupabaseClient | null = null;

function isMock() {
  return process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
}

export const supabaseBrowser = () => {
  if (isMock()) return getMockClient() as unknown as SupabaseClient;
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
  if (isMock()) return getMockClient() as unknown as SupabaseClient;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
};
