import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getMockClient } from '@/lib/supabaseMock';

function isMock() {
  return process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
}

export const supabaseAdmin = (): SupabaseClient => {
  if (isMock()) {
    return getMockClient() as unknown as SupabaseClient;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
};

