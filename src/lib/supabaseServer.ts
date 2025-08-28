import { createClient } from '@supabase/supabase-js';

// Create a Supabase client bound to the provided Authorization header.
// Pass `req.headers.get('authorization')` from a route handler.
export function supabaseFromAuthHeader(authHeader?: string | null) {
  const auth = authHeader || '';
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
