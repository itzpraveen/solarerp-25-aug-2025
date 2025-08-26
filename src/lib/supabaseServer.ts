import { createClient } from '@supabase/supabase-js';
import { getMockClient } from '@/lib/supabaseMock';

function isMock() {
  return process.env.NEXT_PUBLIC_E2E_MOCK === '1' || process.env.E2E_MOCK === '1';
}

// Create a Supabase client bound to the provided Authorization header.
// Pass `req.headers.get('authorization')` from a route handler.
export function supabaseFromAuthHeader(authHeader?: string | null) {
  // In mock mode, always return the in-memory mock client regardless of token
  if (isMock()) return getMockClient() as any;
  const auth = authHeader || '';
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
