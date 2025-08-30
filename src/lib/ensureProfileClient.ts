import type { SupabaseClient } from '@supabase/supabase-js';

// Attempts to ensure the current user's profile exists. Returns tenant_id or null.
export async function ensureProfileIfMissing(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = (u?.user as any)?.id as string | undefined;
    if (!uid) return null;
    const { data: prof } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid)
      .maybeSingle();
    const existing = (prof as any)?.tenant_id as string | undefined;
    if (existing) return existing;
    // Try to create via API (allowed only if self‑signup is enabled)
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (token) {
      try {
        await fetch('/api/auth/ensureProfile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {}
    }
    const { data: prof2 } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', uid)
      .maybeSingle();
    return ((prof2 as any)?.tenant_id as string) || null;
  } catch {
    return null;
  }
}

