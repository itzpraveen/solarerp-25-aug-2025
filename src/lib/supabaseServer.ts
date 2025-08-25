import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

// Create a Supabase client bound to the incoming request's Bearer token.
// Expects the client to send `Authorization: Bearer <access_token>`.
export function supabaseFromAuthHeader() {
  const h = headers();
  const auth = h.get('authorization') || h.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

